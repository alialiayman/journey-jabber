import React, { useEffect, useState } from "react";
import { Button, Grid, Typography, Box } from "@mui/material";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import wtf from "wtf_wikipedia";

const wikiSectionsCategories = ["History", "Geography", "Etymology"];

const LocationInfo = () => {
  const [city, setCity] = useState({});
  const [cityInfo, setCityInfo] = useState(null);
  const [street, setStreet] = useState("");
  const [previousLocation, setPreviousLocation] = useState(null);
  const [uniqueCityNames, setUniqueCityNames] = useState([]);
  const [showUniqueCities, setToggleShowUniqueCities] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  useEffect(() => {
    const interestingLocations = {};
    const getDistance = (point1, point2) => {
      const R = 6371; // Radius of the Earth in kilometers
      const dLat = deg2rad(point2.lat - point1.lat);
      const dLon = deg2rad(point2.lng - point1.lng);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(point1.lat)) *
          Math.cos(deg2rad(point2.lat)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c * 1000; // Convert to meters
      return distance;
    };
    const deg2rad = (deg) => {
      return deg * (Math.PI / 180);
    };

    const queryGooglePlacesAPI = async (location) => {
      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.lat},${location.lng}&key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch address information");
        }

        const data = await response.json();
        const results = data.results;

        results.forEach((element) => {
          if (!interestingLocations[element.formatted_address]) {
            interestingLocations[element.formatted_address] = {};
          }
          element.types.forEach((type) => {
            interestingLocations[element.formatted_address][type] = {};
          });
        });

        const political = Object.entries(interestingLocations)
          .filter((e) => e[1]["political"] && !e[1]["country"])
          .sort((a, b) => {
            if (a[1]["locality"]) {
              return -1;
            }
            const aAdministrativeLevel = Object.keys(a[1]).find((x) =>
              x.startsWith("administrative")
            );
            const aNumber = aAdministrativeLevel?.match(/[1-9]/)?.[0] || 0;
            const bAdministrativeLevel = Object.keys(b[1]).find((x) =>
              x.startsWith("administrative")
            );
            const bNumber = bAdministrativeLevel?.match(/[1-9]/)?.[0] || 0;
            if (aNumber < bNumber) {
              return 1;
            }

            return 1;
          });

        setCity(political);
        const wikiString = political[0][0]
          .replace(/\d+/g, "")
          .split(",")[0]
          .trim();
        const wikipediaData = await wtf.fetch(wikiString);
        setCityInfo(wikipediaData);

        const extractedStreet = results[0]?.address_components.find(
          (component) => component.types.includes("route")
        )?.long_name;

        setStreet(extractedStreet || "");
        setUniqueCityNames(interestingLocations);
      } catch (error) {
        console.error("Error fetching location information:", error);
      }
    };

    // Function to get the user's current location
    const getCurrentLocation = () => {
      setLastRefreshed(new Date().toLocaleTimeString());
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const newLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };

            // Check if the location has changed significantly
            if (
              !previousLocation ||
              getDistance(newLocation, previousLocation) > 1000
            ) {
              setPreviousLocation(newLocation);
              queryGooglePlacesAPI(newLocation);
            }
          },
          (error) => {
            console.error("Error getting location:", error);
          },
          { enableHighAccuracy: true }
        );
      } else {
        console.error("Geolocation is not supported by this browser.");
      }
    };

    // Call the function to get the initial location
    getCurrentLocation();

    // Set up a timer to check for location changes at a regular interval
    const locationCheckTimer = setInterval(getCurrentLocation, 60000); // Check every minute

    // Clear the timer when the component is unmounted
    return () => clearInterval(locationCheckTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previousLocation]);

  const announce = (cityName) => {
    if ("speechSynthesis" in window) {
      const synthesis = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(cityName);

      synthesis.speak(utterance);
    }
  };

  const handleAnnounce = () => {
    announce(city[0]);
    const wikiSections = cityInfo.sections();
    if (wikiSections[0]) {
      announce(wikiSections[0]._wiki.replace(/\n/g, ""));
    }
    wikiSectionsCategories.forEach((s) => {
      const sectionToRead = wikiSections.find((w) => w._title === s);
      if (sectionToRead) {
        announce(sectionToRead._wiki.replace(/\n/g, ""));
      }
    });
  };

  return (
    <Grid
      container
      direction={"column"}
      spacing={4}
      sx={{ width: "100%", height: "100vh" }}
      alignItems={"center"}
      justifyContent={"center"}
    >
      <Grid item>
        {city.length > 0 && city.map((c) => <Box key={c}>{c[0]}</Box>)}
      </Grid>
      <Grid item>
        <Button
          variant="contained"
          endIcon={<VolumeUpIcon />}
          onClick={handleAnnounce}
        >
          Say it
        </Button>
      </Grid>
      <Grid item>
        <Typography variant={"body1"}>
          {cityInfo && cityInfo?.sections()?.[0]?._wiki}
        </Typography>
      </Grid>
      {cityInfo && (
        <Grid item>
          {wikiSectionsCategories.map((s) => (
            <Typography variant="body2">
              {cityInfo.sections().find((s) => s._title === s)?._wiki}
            </Typography>
          ))}
        </Grid>
      )}
      <Grid item>
        <strong>Street:</strong> {street}
      </Grid>
      <Grid item>
        <Typography variant={"caption"}>
          Last refreshed: {lastRefreshed}
        </Typography>
      </Grid>
      <Grid item>
        <Button
          variant="outlined"
          onClick={() => setToggleShowUniqueCities(!showUniqueCities)}
        >
          Toggle
        </Button>
      </Grid>
      {showUniqueCities && Object.keys(uniqueCityNames).length > 0 && (
        <Grid item>
          {Object.keys(uniqueCityNames).map((key) => {
            return (
              <Box key={`${key}${Object.keys(uniqueCityNames[key]).join(",")}`}>
                <Typography variant="body1" sx={{ marginRight: "2rem" }}>
                  {key}
                </Typography>
                <Typography variant="caption">
                  {Object.keys(uniqueCityNames[key]).join(",")}
                </Typography>
              </Box>
            );
          })}
        </Grid>
      )}
    </Grid>
  );
};

export default LocationInfo;
