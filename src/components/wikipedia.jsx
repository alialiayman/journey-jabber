import * as React from "react";

import ArrowForwardIosSharpIcon from "@mui/icons-material/ArrowForwardIosSharp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import { Box, IconButton, Stack, Typography } from "@mui/material";
import MuiAccordion from "@mui/material/Accordion";
import MuiAccordionDetails from "@mui/material/AccordionDetails";
import MuiAccordionSummary from "@mui/material/AccordionSummary";
import { styled } from "@mui/material/styles";
import wtf from "wtf_wikipedia";
import announce, { stopAnnouncement } from "../shared/announce";
import { getDisplayName } from "../shared/getDisplayName";

const trivialTypes = ["political", "country", "continent", "locality"];
const Accordion = styled((props) => (
  <MuiAccordion disableGutters elevation={0} square {...props} />
))(({ theme }) => ({
  border: `1px solid ${theme.palette.divider}`,
  "&:not(:last-child)": {
    borderBottom: 0,
  },
  "&:before": {
    display: "none",
  },
}));

const AccordionSummary = styled((props) => (
  <MuiAccordionSummary
    expandIcon={<ArrowForwardIosSharpIcon sx={{ fontSize: "0.9rem" }} />}
    {...props}
  />
))(({ theme }) => ({
  backgroundColor:
    theme.palette.mode === "dark"
      ? "rgba(255, 255, 255, .05)"
      : "rgba(0, 0, 0, .03)",
  flexDirection: "row-reverse",
  "& .MuiAccordionSummary-expandIconWrapper.Mui-expanded": {
    transform: "rotate(90deg)",
  },
  "& .MuiAccordionSummary-content": {
    marginLeft: theme.spacing(1),
  },
}));

const AccordionDetails = styled(MuiAccordionDetails)(({ theme }) => ({
  padding: theme.spacing(2),
  borderTop: "1px solid rgba(0, 0, 0, .125)",
}));

export default function Wikipedia({ cities, otherPlaces }) {
  const [expanded, setExpanded] = React.useState("wiki");
  const [wikiSections, setWikiSections] = React.useState([]);
  const [isMuted, setIsMuted] = React.useState(true);

  React.useEffect(() => {
    async function getWikipediaInfo() {
      if (!cities || !cities[0] || !getDisplayName(cities)) return;
      const wikiString = getDisplayName(cities)
        .replace(/\d+/g, "")
        .split(",")[0]
        .trim();
      const wikipediaData = await wtf.fetch(wikiString);
      console.log("📢[wikipedia.jsx:66]: wikipediaData: ", wikipediaData);
      setWikiSections(wikipediaData.sections());
    }
    getWikipediaInfo();
  }, [cities]);
  const handleChange = (panel) => (event, newExpanded) => {
    setExpanded(newExpanded ? panel : false);
  };

  const handleSpeak = (mute, text) => {
    setIsMuted(mute);
    if (mute) {
      stopAnnouncement();
    } else {
      stopAnnouncement();
      announce(text);
    }
  };

  return (
    <div>
      {wikiSections?.map((section) => (
        <Accordion
          key={`wiki${section._title}`}
          expanded={expanded === `wiki${section._title}`}
          onChange={handleChange(`wiki${section._title}`)}
        >
          <AccordionSummary aria-controls="panel2d-content" id="panel2d-header">
            <Stack direction={"row"} alignItems={"center"}>
              <Typography>{section._title || "Wikipedia"}</Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Stack direction={"row"} alignItems={"center"}>
              <Typography>{section._wiki}</Typography>
              {isMuted && (
                <IconButton
                  onClick={() => handleSpeak(false, section._wiki)}
                  color="primary"
                >
                  <VolumeUpIcon />
                </IconButton>
              )}
              {!isMuted && (
                <IconButton onClick={() => handleSpeak(true)} color="secondary">
                  <VolumeOffIcon />
                </IconButton>
              )}
            </Stack>
          </AccordionDetails>
        </Accordion>
      ))}
      <Accordion
        expanded={expanded === `wiki-other-places`}
        onChange={handleChange(`wiki-other-places`)}
      >
        <AccordionSummary
          aria-controls="otherplaces-content"
          id="otherplaces-header"
        >
          <Stack direction={"row"} alignItems={"center"}>
            <Typography>{"Nearby"}</Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          {Object.keys(otherPlaces).map((place) => (
            <Stack direction={"row"} alignItems={"center"} key={place}>
              <Box
                sx={{
                  border: "1px solid rgba(0, 0, 0, .125)",
                  padding: "0.5rem",
                  borderRadius: "0.5rem",
                  marginRight: "1rem",
                  marginBottom: "1rem",
                }}
              >
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    place
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {place}
                </a>
              </Box>
              <Typography variant="caption">
                {Object.keys(otherPlaces[place])
                  .filter((key) => !trivialTypes.includes(key))
                  .join(", ")}
              </Typography>
            </Stack>
          ))}
        </AccordionDetails>
      </Accordion>
    </div>
  );
}
