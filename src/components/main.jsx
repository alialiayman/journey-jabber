import React, { useEffect, useState } from "react";

import { Box, Container, Grid } from "@mui/material";
import CityName from "./city-name";
import OtherCities from "./other-cities";
import StreetName from "./street-name";
import Wikipedia from "./wikipedia";

const Main = () => {
  const [political, setPolitical] = useState({});
  const [otherPlaces, setOtherPlaces] = useState({});
  const [street, setStreet] = useState("");
  const [previousLocation, setPreviousLocation] = useState(null);
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

        setPolitical(political);
        setOtherPlaces(interestingLocations);

        const extractedStreet = results[0]?.address_components.find(
          (component) => component.types.includes("route")
        )?.long_name;

        setStreet(extractedStreet || "");
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

  return (
    <Container sx={{ marginTop: "1rem" }}>
      <Grid container direction={"row"}>
        <Grid item xs={6}>
          <CityName cities={political} />
        </Grid>
        <Grid item xs={6}>
          <OtherCities cities={political} />
        </Grid>
      </Grid>
      <Box sx={{ marginTop: "1rem" }}>
        <StreetName
          street={street}
          location={previousLocation}
          lastRefreshed={lastRefreshed}
        />
      </Box>
      <Wikipedia cities={political} otherPlaces={otherPlaces} />
    </Container>
  );
};

export default Main;
