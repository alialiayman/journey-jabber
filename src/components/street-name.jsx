import React from "react";

import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import { IconButton, Stack, Typography, Box } from "@mui/material";
import announce, { stopAnnouncement } from "../shared/announce";

const StreetName = ({ street, location, lastRefreshed }) => {
  const [isMuted, setIsMuted] = React.useState(true);

  const handleSpeak = (mute) => {
    announce(street);
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
        height: "100%",
        paddingLeft: "1rem",
      }}
    >
      <Stack direction={"row"}
      alignItems={"center"}
      
      >
        <Typography variant="h5">{street && `Street: ${street}`}</Typography>
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
      <Box>
        <Typography variant="caption">{JSON.stringify({...location, time: lastRefreshed})}</Typography>
      </Box>
    </Stack>
  );
};

export default StreetName;
