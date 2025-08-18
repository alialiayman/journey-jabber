import React, { useEffect, useRef, useState } from "react";
import {
  AppBar, Toolbar, Typography, Container, Grid, Box, Card, CardContent,
  Stack, Chip, Divider, Alert, CircularProgress, useMediaQuery, IconButton, Button
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import RefreshIcon from "@mui/icons-material/Refresh";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import StopCircleIcon from "@mui/icons-material/StopCircle";

/** Config */
const API_BASE = process.env.REACT_APP_API_BASE || ""; // "" => same-origin via Hosting rewrites
const SIGNIFICANT_MOVE_METERS = 1000;

/** Math helpers */
const deg2rad = (deg) => deg * (Math.PI / 180);
const haversineMeters = (a, b) => {
  const R = 6371e3;
  const dLat = deg2rad(b.lat - a.lat);
  const dLon = deg2rad(b.lng - a.lng);
  const lat1 = deg2rad(a.lat);
  const lat2 = deg2rad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};
const prettyDistance = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

export default function Main() {
  // Location + timestamps
  const [street, setStreet] = useState("");
  const [previousLocation, setPreviousLocation] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // Locality hints
  const [localityCandidate, setLocalityCandidate] = useState("");
  // AI-normalized names
  const [aiCity, setAiCity] = useState("");
  const [aiCityEnglish, setAiCityEnglish] = useState("");
  const [aiStreet, setAiStreet] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  // Travel intel (on-demand)
  const [intel, setIntel] = useState(null); // {nearby_attractions, history, tips, dont_miss, food_spots, nightlife}
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelError, setIntelError] = useState("");

  // Speech Synthesis
  const [speaking, setSpeaking] = useState(false);

  // Compact mode for mobile-landscape
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isLandscape = useMediaQuery("(orientation: landscape)");
  const compact = isMobile && isLandscape;

  // Track last geocode key so we don’t repeat normalization on trivial changes
  const lastNormKeyRef = useRef("");

  /** ---- API calls ---- */
  async function callNormalize({ lat, lng, rawCity, rawStreet, country, admin2, parentCityHint }) {
    const res = await fetch(`${API_BASE}/api/normalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng, rawCity, rawStreet, country, admin2, parentCityHint }),
    });
    if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
    return res.json(); // { city, city_english, street, display_city?, raw }
  }

  async function callIntel({ lat, lng, city }) {
    const res = await fetch(`${API_BASE}/api/intel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng, city }),
    });
    if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
    return res.json(); // { nearby_attractions, history, tips, dont_miss, raw }
  }

  /** Geocode → derive locality/admin2/country → normalize via AI */
  async function queryGeocodeAndNormalize(location) {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.lat},${location.lng}&key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}`
      );
      if (!response.ok) throw new Error("Failed to fetch address information");

      const data = await response.json();
      const results = data.results || [];

      // Street (route)
      const first = results[0];
      const routeComp = first?.address_components?.find((c) => c.types.includes("route"));
      const streetName = routeComp?.long_name || "";
      setStreet(streetName);

      // Components across all results
      const allComps = results.flatMap((r) => r.address_components || []);
      const pick = (type) => allComps.find((c) => c.types.includes(type));
      const country = pick("country")?.long_name || "";
      const admin2 = pick("administrative_area_level_2")?.long_name || "";

      // Prefer locality; fallback to sublocality
      const localityComp =
        pick("locality") ||
        allComps.find((c) => c.types.some((t) => t.startsWith("sublocality")));
      const locality = localityComp?.long_name || "";

      // Inner-Paris hint
      const PARIS_DEPTS = new Set(["Seine-Saint-Denis", "Hauts-de-Seine", "Val-de-Marne"]);
      const parentHint = locality && PARIS_DEPTS.has(admin2) && locality !== "Paris" ? "Paris" : "";

      setLocalityCandidate(locality || "");
      // Avoid redundant normalize calls if nothing changed
      const normKey = `${locality}|${streetName}|${admin2}|${country}|${parentHint}`;
      if (lastNormKeyRef.current === normKey) return;
      lastNormKeyRef.current = normKey;

      // Normalize via AI
      setAiLoading(true);
      setAiError("");
      const norm = await callNormalize({
        lat: location.lat,
        lng: location.lng,
        rawCity: locality || "",
        rawStreet: streetName,
        country,
        admin2,
        parentCityHint: parentHint,
      });

      const baseCity = norm?.city || locality || "";
      const displayCity = norm?.display_city || (parentHint ? `${baseCity}, ${parentHint}` : baseCity);

      setAiCity(displayCity);
      setAiCityEnglish(norm?.city_english || "");
      setAiStreet(norm?.street || streetName || "");
    } catch (e) {
      console.error(e);
      setAiError(e.message || "Failed to fetch/normalize names");
    } finally {
      setAiLoading(false);
    }
  }

  /** On-demand: fetch Travel Intel (+ food + nightlife) */
  const getIntel = async () => {
    if (!previousLocation) return;
    const cityKey = (aiCity || localityCandidate || "").trim();
    if (!cityKey) return;

    setIntelLoading(true);
    setIntelError("");
    try {
      const { lat, lng } = previousLocation;

      const [ai] = await Promise.all([
        callIntel({ lat, lng, city: cityKey })
      ]);

      setIntel({
        nearby_attractions: ai?.nearby_attractions || [],
        history: ai?.history || [],
        tips: ai?.tips || [],
        dont_miss: ai?.dont_miss || [],
        raw: ai?.raw,
      });
    } catch (e) {
      console.error(e);
      setIntelError(e.message || "Failed to load travel intel");
    } finally {
      setIntelLoading(false);
    }
  };

  /** Location poller: auto refresh every minute; backend called only if moved significantly */
  useEffect(() => {
    const getCurrentLocation = () => {
      setLastRefreshed(new Date().toLocaleTimeString());
      if (!navigator.geolocation) return console.error("Geolocation not supported.");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          if (!previousLocation || haversineMeters(newLoc, previousLocation) > SIGNIFICANT_MOVE_METERS) {
            setPreviousLocation(newLoc);
            // Normalize immediately on significant change
            queryGeocodeAndNormalize(newLoc);
            // Clear last intel (new area)
            setIntel(null);
          }
        },
        (err) => console.error("Error getting location:", err),
        { enableHighAccuracy: true }
      );
    };
    getCurrentLocation();
    const timer = setInterval(getCurrentLocation, 60000); // auto refresh every minute
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previousLocation]);

  const handleRefresh = () => {
    if (previousLocation) {
      queryGeocodeAndNormalize(previousLocation);
      // keep intel as is until user requests again
    }
  };

  /** ---- Speech Synthesis ---- */
  const getSynth = () => (typeof window !== "undefined" ? window.speechSynthesis : null);
  const cancelSpeech = () => {
    const s = getSynth();
    if (s) s.cancel();
    setSpeaking(false);
  };
  const speak = (text, { rate = 1, pitch = 1, lang } = {}) => {
    const s = getSynth();
    if (!s || !text) return;
    try {
      cancelSpeech();
      const u = new SpeechSynthesisUtterance(text);
      if (lang) u.lang = lang;
      u.rate = rate;
      u.pitch = pitch;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      s.speak(u);
    } catch {
      setSpeaking(false);
    }
  };

  const speakCityAndStreet = () => {
    const phrase = [aiCity || localityCandidate, aiStreet || street].filter(Boolean).join(", ");
    speak(phrase);
  };

  const buildIntelNarration = (data) => {
    if (!data) return "";
    const parts = [];
    if (aiCity) parts.push(aiCity);
    if (aiStreet) parts.push(`Street: ${aiStreet}`);
    const addList = (label, arr, mapItem = (x) => x) => {
      if (Array.isArray(arr) && arr.length) {
        const items = arr.slice(0, 6).map(mapItem).join("; ");
        parts.push(`${label}: ${items}`);
      }
    };
    addList("Nearby attractions", data.nearby_attractions, (a) => a?.name || "");
    addList("Don't miss", data.dont_miss);
    addList("History", data.history);
    addList("Tips", data.tips);
    addList("Food nearby", data.food_spots, (r) => r?.name || "");
    addList("Night activities", data.nightlife, (r) => r?.name || "");
    return parts.filter(Boolean).join(". ");
  };

  const speakIntel = () => {
    const text = buildIntelNarration(intel);
    if (text) speak(text, { rate: 1 });
  };

  /** COMPACT VIEW (mobile landscape) — centered + button to fetch intel */
  if (compact) {
    return (
      <>
        <AppBar position="sticky" elevation={0}>
          <Toolbar sx={{ minHeight: 48 }}>
            <TravelExploreIcon sx={{ mr: 1 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Journey Japper
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Chip label={lastRefreshed ? `Refreshed: ${lastRefreshed}` : "Locating…"} size="small" />
            <Button color="inherit" startIcon={<RefreshIcon />} onClick={handleRefresh} sx={{ ml: 1 }}>
              Refresh
            </Button>
          </Toolbar>
        </AppBar>

        <Container maxWidth="md" sx={{ py: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Card variant="outlined" sx={{ borderRadius: 3, width: "100%" }}>
            <CardContent
              sx={{
                py: 2,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              {aiLoading ? (
                <Stack direction="row" alignItems="center" justifyContent="center" spacing={1}>
                  <CircularProgress size={20} />
                  <Typography>Normalizing names…</Typography>
                </Stack>
              ) : (
                <Stack alignItems="center" spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography
                      variant="h3"
                      sx={{ fontWeight: 900, lineHeight: 1.1, cursor: "pointer" }}
                      onClick={speakCityAndStreet}
                      title="Tap to speak city & street"
                    >
                      {aiCity || "—"}
                    </Typography>
                    <IconButton aria-label={speaking ? "Stop" : "Speak"} onClick={speaking ? cancelSpeech : speakCityAndStreet}>
                      {speaking ? <StopCircleIcon /> : <VolumeUpIcon />}
                    </IconButton>
                  </Stack>

                  <Typography
                    variant="h6"
                    color="text.secondary"
                    sx={{ mt: 0.25, cursor: "pointer" }}
                    onClick={speakCityAndStreet}
                    title="Tap to speak city & street"
                  >
                    {aiStreet || street || "—"}
                  </Typography>

                  {aiError ? <Alert severity="error" sx={{ mt: 1, width: "100%" }}>{aiError}</Alert> : null}

                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Button
                      variant="contained"
                      onClick={getIntel}
                      disabled={intelLoading || !previousLocation}
                    >
                      {intelLoading ? "Loading intel…" : "Get travel intel"}
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={speaking ? cancelSpeech : speakIntel}
                      disabled={!intel}
                    >
                      {speaking ? "Stop" : "Speak intel"}
                    </Button>
                  </Stack>
                </Stack>
              )}
            </CardContent>
          </Card>
        </Container>

        {/* Show intel below when fetched */}
        {intelError ? (
          <Container maxWidth="md" sx={{ py: 1 }}>
            <Alert severity="error">{intelError}</Alert>
          </Container>
        ) : null}
        {intel ? (
          <Container maxWidth="md" sx={{ pb: 2 }}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, textAlign: "center", mb: 1 }}>
                  Travel Intel
                </Typography>
                <Stack spacing={1}>
                  {(intel.nearby_attractions || []).length > 0 && (
                    <>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Nearby attractions</Typography>
                      <Stack spacing={0.5}>
                        {intel.nearby_attractions.map((a, i) => (
                          <Typography key={i} variant="body2">• {a.name}{a.note ? ` — ${a.note}` : ""}</Typography>
                        ))}
                      </Stack>
                    </>
                  )}

                  {(intel.dont_miss || []).length > 0 && (
                    <>
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Don’t miss</Typography>
                      <Stack spacing={0.5}>
                        {intel.dont_miss.map((t, i) => (
                          <Typography key={i} variant="body2">• {t}</Typography>
                        ))}
                      </Stack>
                    </>
                  )}

                  {(intel.history || []).length > 0 && (
                    <>
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>History</Typography>
                      <Stack spacing={0.5}>
                        {intel.history.map((h, i) => (
                          <Typography key={i} variant="body2">• {h}</Typography>
                        ))}
                      </Stack>
                    </>
                  )}

                  {(intel.tips || []).length > 0 && (
                    <>
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Tips</Typography>
                      <Stack spacing={0.5}>
                        {intel.tips.map((t, i) => (
                          <Typography key={i} variant="body2">• {t}</Typography>
                        ))}
                      </Stack>
                    </>
                  )}

                  {(intel.food_spots || []).length > 0 && (
                    <>
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Egyptian & Middle Eastern Food Nearby
                      </Typography>
                      <Stack spacing={0.75}>
                        {intel.food_spots.map((r) => (
                          <Box key={r.id}>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              {r.name} {r.rating ? `· ⭐ ${r.rating} (${r.ratings})` : ""}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {r.vicinity || ""} {Number.isFinite(r.distance) ? `· ${prettyDistance(r.distance)}` : ""}
                              {r.openNow === true ? " · Open now" : r.openNow === false ? " · Closed now" : ""}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </>
                  )}

                  {(intel.nightlife || []).length > 0 && (
                    <>
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Night Activities Nearby
                      </Typography>
                      <Stack spacing={0.75}>
                        {intel.nightlife.map((r) => (
                          <Box key={r.id}>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              {r.name} {r.rating ? `· ⭐ ${r.rating} (${r.ratings})` : ""}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {r.vicinity || ""} {Number.isFinite(r.distance) ? `· ${prettyDistance(r.distance)}` : ""}
                              {r.openNow === true ? " · Open now" : r.openNow === false ? " · Closed now" : ""}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Container>
        ) : null}
      </>
    );
  }

  /** FULL VIEW (desktop/portrait) — with button to fetch intel on demand */
  return (
    <>
      <AppBar position="sticky" elevation={0}>
        <Toolbar>
          <TravelExploreIcon sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Journey Japper
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Chip label={lastRefreshed ? `Last refresh: ${lastRefreshed}` : "Locating…"} size="small" />
          <Button color="inherit" startIcon={<RefreshIcon />} onClick={handleRefresh} sx={{ ml: 1 }}>
            Refresh
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Grid container spacing={2}>
          {/* Current location */}
          <Grid item xs={12}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Stack spacing={1}>
                  <Typography variant="overline" color="text.secondary">
                    Your current location
                  </Typography>

                  {aiLoading ? (
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <CircularProgress size={20} /> <Typography>Normalizing names…</Typography>
                    </Stack>
                  ) : (
                    <>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography
                          variant="h4"
                          sx={{ fontWeight: 800, cursor: "pointer" }}
                          onClick={speakCityAndStreet}
                          title="Click to speak city & street"
                        >
                          {aiCity || "—"}
                        </Typography>
                        <IconButton aria-label={speaking ? "Stop" : "Speak"} onClick={speaking ? cancelSpeech : speakCityAndStreet}>
                          {speaking ? <StopCircleIcon /> : <VolumeUpIcon />}
                        </IconButton>
                      </Stack>

                      {aiCityEnglish && aiCityEnglish !== aiCity ? (
                        <Typography variant="body2" color="text.secondary">
                          English: {aiCityEnglish}
                        </Typography>
                      ) : null}

                      <Typography
                        variant="subtitle1"
                        sx={{ mt: 0.5, cursor: "pointer" }}
                        onClick={speakCityAndStreet}
                        title="Click to speak city & street"
                      >
                        {aiStreet || street || "—"}
                      </Typography>

                      {aiError ? <Alert severity="error">{aiError}</Alert> : null}
                    </>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Travel Intel (on-demand) */}
          <Grid item xs={12}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1, gap: 1, flexWrap: "wrap" }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Travel Intel
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Button variant="contained" onClick={getIntel} disabled={intelLoading || !previousLocation}>
                      {intelLoading ? "Loading intel…" : "Get travel intel"}
                    </Button>
                    <Button variant="outlined" onClick={speaking ? cancelSpeech : speakIntel} disabled={!intel}>
                      {speaking ? "Stop" : "Speak intel"}
                    </Button>
                  </Box>
                </Stack>

                {intelLoading ? (
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <CircularProgress size={20} /> <Typography>Gathering nearby highlights…</Typography>
                  </Stack>
                ) : intelError ? (
                  <Alert severity="error">{intelError}</Alert>
                ) : intel ? (
                  <Stack spacing={1.5}>
                    {(intel.nearby_attractions || []).length > 0 && (
                      <>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Nearby attractions</Typography>
                        <Stack spacing={0.5}>
                          {intel.nearby_attractions.map((a, i) => (
                            <Typography key={i} variant="body2">• {a.name}{a.note ? ` — ${a.note}` : ""}</Typography>
                          ))}
                        </Stack>
                      </>
                    )}

                    {(intel.dont_miss || []).length > 0 && (
                      <>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Don’t miss</Typography>
                        <Stack spacing={0.5}>
                          {intel.dont_miss.map((t, i) => (
                            <Typography key={i} variant="body2">• {t}</Typography>
                          ))}
                        </Stack>
                      </>
                    )}

                    {(intel.history || []).length > 0 && (
                      <>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>History</Typography>
                        <Stack spacing={0.5}>
                          {intel.history.map((h, i) => (
                            <Typography key={i} variant="body2">• {h}</Typography>
                          ))}
                        </Stack>
                      </>
                    )}

                    {(intel.tips || []).length > 0 && (
                      <>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Tips</Typography>
                        <Stack spacing={0.5}>
                          {intel.tips.map((t, i) => (
                            <Typography key={i} variant="body2">• {t}</Typography>
                          ))}
                        </Stack>
                      </>
                    )}

                    {(intel.food_spots || []).length > 0 && (
                      <>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          Egyptian & Middle Eastern Food Nearby
                        </Typography>
                        <Stack spacing={0.75}>
                          {intel.food_spots.map((r) => (
                            <Box key={r.id}>
                              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                {r.name} {r.rating ? `· ⭐ ${r.rating} (${r.ratings})` : ""}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {r.vicinity || ""} {Number.isFinite(r.distance) ? `· ${prettyDistance(r.distance)}` : ""}
                                {r.openNow === true ? " · Open now" : r.openNow === false ? " · Closed now" : ""}
                              </Typography>
                            </Box>
                          ))}
                        </Stack>
                      </>
                    )}

                    {(intel.nightlife || []).length > 0 && (
                      <>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          Night Activities Nearby
                        </Typography>
                        <Stack spacing={0.75}>
                          {intel.nightlife.map((r) => (
                            <Box key={r.id}>
                              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                {r.name} {r.rating ? `· ⭐ ${r.rating} (${r.ratings})` : ""}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {r.vicinity || ""} {Number.isFinite(r.distance) ? `· ${prettyDistance(r.distance)}` : ""}
                                {r.openNow === true ? " · Open now" : r.openNow === false ? " · Closed now" : ""}
                              </Typography>
                            </Box>
                          ))}
                        </Stack>
                      </>
                    )}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Click “Get travel intel” to load highlights for your current spot.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </>
  );
}
