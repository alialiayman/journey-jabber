import React from "react";

import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import { Box, IconButton, Stack, Typography } from "@mui/material";
import announce, { stopAnnouncement } from "../shared/announce";

const OtherCities = ({ cities }) => {
  const [isMuted, setIsMuted] = React.useState(true);

  if (!Array.isArray(cities)) {
    return null;
  }

  const handleSpeak = (mute) => {
    announce(cities?.map((city) => city[0].split(",")[0]).join(", "));
    setIsMuted(mute);
    if (mute) {
      stopAnnouncement();
    }
  };
  return (
    <Stack
      direction={"row"}
      justifyContent={"space-between"}
      alignItems={"center"}
      sx={{
        height: "100%",
        width: "98%",
        backgroundColor: "hsl(300,100%,95%)",
        marginLeft: "1rem",
        borderRadius: "1rem",
      }}
    >
      <Box>
        <Typography variant="subtitle1" sx={{color: 'hsl(300,100%,20%)'}}>
          {cities?.map((city) => city[0].split(",")[0]).join(", ")}
        </Typography>
      </Box>
      {isMuted && (
        <IconButton onClick={() => handleSpeak(false)} sx={{color: 'hsl(300,100%,20%)'}}>
          <VolumeUpIcon />
        </IconButton>
      )}
      {!isMuted && (
        <IconButton onClick={() => handleSpeak(true)} sx={{color: 'hsl(300,100%,20%)'}}>
          <VolumeOffIcon />
        </IconButton>
      )}
    </Stack>
  );
};

export default OtherCities;
