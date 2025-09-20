export const MOCK_COURSES = [
    {
      id: 1,
      name: "Pebble Beach",
      location: "California",
      rating: 74.5,
      slope: 144,
      par: 72,
      holes: Array.from({ length: 18 }, (_, i) => ({
        hole_number: i + 1,
        par: 4,
        yardage: 400 + (i % 5) * 10,
        handicap: (i % 18) + 1
      }))
    },
    // ... add more courses
  ];
  