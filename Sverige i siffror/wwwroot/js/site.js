// Replace these with your desired coordinates and zoom level
var latitude = 63.505; // Replace with your latitude
var longitude = 18.09; // Replace with your longitude
var zoomLevel = 5;    // Replace with your desired zoom level


// Initialize your Leaflet map
var map = L.map('map').setView([latitude, longitude], zoomLevel);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

// Define the current projection (SWEREF99_TM)
var currentProjection = '+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';

// Define the target projection (WGS84)
var targetProjection = '+proj=longlat +datum=WGS84 +no_defs';

function transformCoordinates(coord) {
    try {
        var transformedCoord = proj4(currentProjection, targetProjection, coord);
        return transformedCoord;
    } catch (error) {
        console.error('Error transforming coordinate:', error);
        return coord; // Return the original coordinate on error
    }
}

function loadNewMap(dataFile = "befolkning.json", dataTitle = "befolkning", color1 = "#55ff55", color2 = "#ff5555", exponent = 0.2) {

    map.eachLayer(function (layer) {
        if (layer instanceof L.LayerGroup) {
            // Clear layers within LayerGroup
            layer.clearLayers();
        } else {
            // Remove individual layers
            map.removeLayer(layer);
        }
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Load your GeoJSON data
    Promise.all([
        fetch('/DataFiles/kommuner.json').then(response => response.json()),
        fetch(`/DataFiles/${dataFile}`).then(response => response.json())
    ])
        .then(function ([geojsonData, populationData]) {
            try {
                // Transform the GeoJSON coordinates to WGS84
                geojsonData.features.forEach(function (feature) {
                    // Transform coordinates for both Polygon and MultiPolygon
                    if (feature.geometry.type === 'Polygon') {
                        feature.geometry.coordinates = feature.geometry.coordinates.map(function (ringCoords) {
                            return ringCoords.map(transformCoordinates);
                        });
                    }
                    if (feature.geometry.type === 'MultiPolygon') {
                        feature.geometry.coordinates = feature.geometry.coordinates.map(function (polygonCoords) {
                            return polygonCoords.map(function (ringCoords) {
                                return ringCoords.map(transformCoordinates);
                            });
                        });
                    }
                });

                // Create a map from kommun code to population
                var populationMap = {};
                populationData.data.forEach(function (entry) {
                    var kommunCode = entry.key[0];
                    var population = +entry.values[0]; // Convert population to a number
                    populationMap[kommunCode] = population;
                });

                // Define a color scale based on population
                var maxPopulation = d3.max(populationData.data, function (d) {
                    return +d.values[0];
                });
                var minPopulation = d3.min(populationData.data, function (d) {
                    return +d.values[0];
                });
                var colorScale = d3.scalePow()
                    .domain([minPopulation, maxPopulation])
                    .range([color1, color2]).exponent(exponent);

                // Your GeoJSON data is now transformed
                var kommunerGeoJSON = L.geoJSON(geojsonData, {
                    style: function (feature) {
                        // Get the kommun code from the feature properties
                        var kommunCode = feature.properties.kommun.substring(0, 4);
                        // Find the population for this kommun code
                        var population = populationMap[kommunCode];
                        // Calculate the color based on population
                        var color = colorScale(population || 0); // Default to 0 population if not found

                        return {
                            fillColor: color,
                            weight: 1,
                            opacity: 1,
                            color: 'white',
                            dashArray: '3',
                            fillOpacity: 0.5
                        };
                    },
                    onEachFeature: function (feature, layer) {
                        // Get the kommun code from the feature properties
                        var kommunCode = feature.properties.kommun.substring(0, 4);
                        // Find the population for this kommun code
                        var population = populationMap[kommunCode];

                        var popupContent = population !== undefined ?
                            "<b>Kommun:</b> " + feature.properties.kommun +
                            `<br><b>${dataTitle}:</b> ` + population :
                            "No population data available";

                        document.getElementById("title").textContent = dataTitle;

                        layer.bindPopup(popupContent);
                    }
                }).addTo(map);
            } catch (error) {
                console.error('Error processing GeoJSON data:', error);
            }
        })
        .catch(function (error) {
            console.error('Error loading data:', error);
        });
}
