#! /usr/bin/env bun

const data = [
  { lon: 2.401244, lat: 48.862044 },
  { lon: 2.399968, lat: 48.863221 },
  { lon: 2.39989, lat: 48.863279 },
  { lon: 2.399817, lat: 48.863295 },
  { lon: 2.399714, lat: 48.863297 },
];

console.log(
  JSON.stringify({
    type: "FeatureCollection",
    features: [
      ...data.map((it, index) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [it.lon, it.lat],
        },
        properties: {
          index,
        },
      })),
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: data.map((it) => [it.lon, it.lat]),
        },
        properties: {},
      },
    ],
  }),
);
