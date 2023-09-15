// Replace these with your desired coordinates and zoom level
var latitude = 63.505; // Replace with your latitude
var longitude = 18.09; // Replace with your longitude
var zoomLevel = 4;    // Replace with your desired zoom level


// Initialize your Leaflet map
var map = L.map('map').setView([latitude, longitude], zoomLevel);

L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_toner_background/{z}/{x}/{y}{r}.{ext}', {
    minZoom: 4,
    maxZoom: 10,
    attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.stamen.com/" target="_blank">Stamen Design</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    ext: 'png'
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

function loadNewMap(dataFile = "befolkning.json", dataTitle = "befolkning", color1 = "#00ff00", color2 = "#0000ff", exponent = 1) {

    map.eachLayer(function (layer) {
        if (layer instanceof L.LayerGroup) {
            // Clear layers within LayerGroup
            layer.clearLayers();
        } else {
            // Remove individual layers
            map.removeLayer(layer);
        }
    });

    L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_toner_background/{z}/{x}/{y}{r}.{ext}', {
        minZoom: 4,
        maxZoom: 10,
        attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.stamen.com/" target="_blank">Stamen Design</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        ext: 'png'
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

                        // Default style for features with no population data
                        var defaultStyle = {
                            fillColor: '#aaaaaa', // Gray color
                            weight: 1,
                            opacity: 1,
                            color: '#white', // Darker gray border color
                            dashArray: '3',
                            fillOpacity: 0.5
                        };

                        // Check if population data exists
                        if (population) {
                            // Calculate the color based on population
                            var color = colorScale(population);
                            return {
                                fillColor: color,
                                weight: 1,
                                opacity: 1,
                                color: 'white',
                                dashArray: '3',
                                fillOpacity: 0.9
                            };
                        } else {
                            // Set the default gray style when data does not exist
                            return defaultStyle;
                        }
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
                });

                // Add the GeoJSON layer to the map
                kommunerGeoJSON.addTo(map);

                // Add the tile layer on top of the GeoJSON layer
                L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_toner_background/{z}/{x}/{y}{r}.{ext}', {
                    minZoom: 4,
                    maxZoom: 10,
                    attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.stamen.com/" target="_blank">Stamen Design</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                    ext: 'png'
                }).addTo(map);

            } catch (error) {
                console.error('Error processing GeoJSON data:', error);
            }
        })
        .catch(function (error) {
            console.error('Error loading data:', error);
        });
}
