import React, { useEffect, useState } from "react";
import { Button, Grid, Typography } from "@mui/material";
import wtf from "wtf_wikipedia";

const LocationInfo = () => {
  const [city, setCity] = useState("");
  const [cityInfo, setCityInfo] = useState(null);
  const [street, setStreet] = useState("");
  const [previousLocation, setPreviousLocation] = useState(null);
  const [uniqueCityNames, setUniqueCityNames] = useState([]);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  useEffect(() => {
    // Function to calculate the distance between two points (in meters)
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

    // Function to convert degrees to radians
    const deg2rad = (deg) => {
      return deg * (Math.PI / 180);
    };

    // Function to query Google Places API based on the location
    const queryGooglePlacesAPI = async (location) => {
      // Implement your logic to query Google Places API here
      // You can use the location (latitude and longitude) to get city information
      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.lat},${location.lng}&key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch address information");
        }

        const data = await response.json();

        const politicalResult = data.results
          .filter(
            (result) =>
              result.types.includes("locality") ||
              result.types.includes("political")
          )
          .map((result) => result.address_components);

        politicalResult.forEach((result) => {
          result.forEach((component) => {
            if (uniqueCityNames.includes(component.long_name)) {
              return;
            }
            uniqueCityNames.push(component.long_name);
          });
        });

        setUniqueCityNames(uniqueCityNames);

        const cityResult = data.results.find(
          (result) =>
            result.types.includes("locality") ||
            result.types.includes("political")
        );
        let extractedCity;
        let extractedStreet;
        if (cityResult) {
          extractedCity = cityResult.address_components.find((component) =>
            component.types.includes("locality")
          )?.long_name;

          setCity(extractedCity || "");
          const wikipediaData = await wtf.fetch(extractedCity);

          // Extracting short description from Wikipedia data
          const shortDescription = wikipediaData?.sections()?.[0]?._wiki;
          setCityInfo(shortDescription || "");

          extractedStreet = data.results[0]?.address_components.find(
            (component) => component.types.includes("route")
          )?.long_name;

          setStreet(extractedStreet || "");
        } else {
          // Handle the case where a city name is not found
        }
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
              // Call a function to query Google Places API for city information
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
    announce(city);
    if (cityInfo) {
      announce(cityInfo);
    }
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
        <Typography variant={"h4"}>{city}</Typography>
      </Grid>
      <Grid item>
        <Typography variant={"body1"}>{cityInfo}</Typography>
      </Grid>
      <Grid item>
        <strong>Street:</strong> {street}
      </Grid>
      {uniqueCityNames.length > 0 && (
        <Grid item>
          <strong>Unique City Names:</strong>
          <ul>
            {uniqueCityNames.map((cityName) => (
              <li key={cityName}>{cityName}</li>
            ))}
          </ul>
        </Grid>
      )}
      <Grid item>
        <Button variant="contained" onClick={handleAnnounce}>
          Announce
        </Button>
      </Grid>
      <Grid item>
        <Typography variant={"caption"}>
          Last refreshed: {lastRefreshed}
        </Typography>
      </Grid>
    </Grid>
  );
};

export default LocationInfo;
