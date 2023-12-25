import React from "react";

import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import { Box, IconButton, Stack, Typography } from "@mui/material";
import announce, { stopAnnouncement } from "../shared/announce";
import { getDisplayName } from "../shared/getDisplayName";
import { RefreshOutlined } from "@mui/icons-material";

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
      justifyContent={"space-between"}
      sx={{
        boxShadow: "0 4px 8px hsl(120, 100%, 15%)",
        height: "100%",
        paddingLeft: "1rem",
        borderRadius: "1rem",
        backgroundColor: "hsl(120,100%,95%)",
      }}
    >
      <Typography variant="h4" color="primary">
        {cities && getDisplayName(cities)}
      </Typography>
      <Box>
      {isMuted && (
        <IconButton onClick={() => handleSpeak(false)} color="primary">
          <VolumeUpIcon sx={{color: 'hsl(120,100%,20%)'}}/>
        </IconButton>
      )}
      {!isMuted && (
        <IconButton onClick={() => handleSpeak(true)} >
          <VolumeOffIcon sx={{color: 'hsl(120,100%,20%)'}}/>
        </IconButton>
      )}
      <IconButton >
        <RefreshOutlined onClick={() => window.location.reload()} sx={{color: 'hsl(120,100%,20%)'}}/>
      </IconButton>
      </Box>
    </Stack>
  );
};

export default CityName;
