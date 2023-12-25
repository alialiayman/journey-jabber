import React from "react";

import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import { IconButton, Stack, Typography } from "@mui/material";
import announce, { stopAnnouncement } from "../shared/announce";
import { getDisplayName } from "../shared/getDisplayName";

const CityName = ({ cities }) => {
  const [isMuted, setIsMuted] = React.useState(true);

  const handleSpeak = (mute) => {
    announce(getDisplayName(cities));
    setIsMuted(mute);
    if (mute) {
      stopAnnouncement();
    }
  };

  return (
    <Stack
      direction={"row"}
      alignItems={"center"}
      sx={{
        boxShadow: "0 4px 8px green",
        height: "100%",
        paddingLeft: "1rem",
      }}
    >
      <Typography variant="h4" color="primary">
        {cities && getDisplayName(cities)}
      </Typography>
      {isMuted && (
        <IconButton onClick={() => handleSpeak(false)} color="primary">
          <VolumeUpIcon />
        </IconButton>
      )}
      {!isMuted && (
        <IconButton onClick={() => handleSpeak(true)} color="secondary">
          <VolumeOffIcon />
        </IconButton>
      )}
    </Stack>
  );
};

export default CityName;
