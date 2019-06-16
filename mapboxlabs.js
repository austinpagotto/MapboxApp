L.mapbox.accessToken = 'pk.eyJ1IjoiaGV5aXRzZ2FycmV0dCIsImEiOiIwdWt5ZlpjIn0.73b7Y47rgFnSD7QCNeS-zA';

var map = L.mapbox.map('map', 'duncangraham.b134a19e',{ zoomControl: false })
    .setView([38.90512740512037,-77.03433036804199], 14);

var isEmbed = location.search;
isEmbed = isEmbed.slice(1);

if ( isEmbed == 'embed' ) {
    new L.Control.Zoom({ position: 'topright' }).addTo(map);
    map.scrollWheelZoom.disable();
}

var marker = L.marker(new L.LatLng(38.904,-77.032), {
    icon: L.mapbox.marker.icon({
        "marker-color": "#8E8E8E",
        "title": "where are the stations?",
        "marker-symbol": "pitch",
        "marker-size": "large"    }),
    draggable: true,
    zIndexOffset:999
});

var start,
    destination;

var currentPosition;

//geolocation
function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(showPosition);
    }
}

function showPosition(position) {
    currentPosition=[position.coords.latitude, position.coords.longitude];
    //if in DC, show geocoder.
    if ( currentPosition[0] >= 38.77442837007637 && currentPosition[0] <= 39.04478604850143 && currentPosition[1] >= -77.23800659179688 && currentPosition[1] <= -76.82601928710938 ) {
        $('#geolocate').show();
    }
}

function pointBuffer (pt, radius, units, resolution) {
  var ring = []
  var resMultiple = 360/resolution;
  for(var i  = 0; i < resolution; i++) {
    var spoke = turf.destination(pt, radius, i*resMultiple, units);
    ring.push(spoke.geometry.coordinates);
  }
  if((ring[0][0] !== ring[ring.length-1][0]) && (ring[0][1] != ring[ring.length-1][1])) {
    ring.push([ring[0][0], ring[0][1]]);
  }
  return turf.polygon([ring])
}

$.get('stations.geojson', function(data){
    //test if data is JSON
    if(typeof data == 'object') {
        var fc = data;
    } else {
        var fc = JSON.parse(data);
    }

    $('#findme').on('click', function(){
        marker.setLatLng(currentPosition);
        map.setView(currentPosition,14);
        updateVenues();
    });

    //input search functionality
    $('fieldset input').keyup(function(event) {
            var contents=$('fieldset input').val();
            var url='https://api.tiles.mapbox.com/v4/geocode/mapbox.places/'+contents+'.json?access_token='+L.mapbox.accessToken;

            $.get(url, function(data){
                $('.result').remove();
                data.features.forEach(function(result){
                    var place = result['place_name'];
                    var reg = new RegExp(contents,"gi");
                    place = place.replace(reg, function (match) {return "<strong>" + match + "</strong>"});
                    $('#searchresults')
                    .append('<div class="result keyline-bottom keyline-left keyline-right small">'+place+'</div>')
                    });
                $('.result').each(function(index){
                    var coords= (data.features[index]['center']);
                    $(this).on('click', function(){
                        map.setView([coords[1], coords[0]], 13);
                        marker.setLatLng([coords[1], coords[0]]);
                        updateVenues();
                        })
                    })
                })

            if (event.keyCode == 13) {
                geocoder.query(contents, showMap);
                $('input').blur();
            }
        });

    // get position, draw buffer, find within, find nearest, add to map
    function updateVenues(){
        $('path').remove();
        $('.leaflet-marker-pane img').not(':first').remove();
        var position=marker.getLatLng();

        var point=turf.point(position.lng, position.lat);

        //draw buffer
        var bufferLayer = L.mapbox.featureLayer().addTo(map);
            var buffer = pointBuffer(point, .25, 'miles', 120);
            buffer.properties = {
                "fill": "#00704A",
                "fill-opacity":0.1,
                "stroke": "#00704A",
                "stroke-width": 2,
                "stroke-opacity": 0.5
            };

        bufferLayer.setGeoJSON(buffer);
        //var within = turf.within(fc,bufferLayer.getGeoJSON());

        var within = turf.featurecollection(fc.features.filter(function(shop){
            if (turf.distance(shop, point, 'miles') <= .25) return true;
        }));
        $('#milecount').html(within.features.length);
        function mileConvert(miles){
            if (miles<=0.25){
                return (miles*5280).toFixed(0)+' ft';
            } else {
                return miles.toFixed(2) +' mi';
            }
        }
        within.features.forEach(function(feature){
            var distance = parseFloat(turf.distance(point, feature, 'miles'));
            feature.properties["marker-color"] = "C73E3E";
            feature.properties["title"] = '<span>'+mileConvert(distance)+'</span><br>'+feature.properties["name"]+'<br>Bikes: '+feature.properties["nbBikes"]+'<br>Empty Docks: '+feature.properties["nbEmptyDocks"];
            feature.properties["marker-size"] = "medium";
            feature.properties["marker-symbol"] = "bicycle";
        })

        var nearest = turf.nearest(point, fc);
        var nearestdist = parseFloat(turf.distance(point, nearest, 'miles'));

            nearest.properties["marker-color"] = "C73E3E";
            nearest.properties["title"] = '<span>'+mileConvert(nearestdist)+' (nearest)</span><br>'+nearest.properties["name"]+'<br>Bikes: '+nearest.properties["nbBikes"]+'<br>Empty Docks: '+nearest.properties["nbEmptyDocks"];
            nearest.properties["marker-size"] = "large";
            nearest.properties["marker-symbol"] = "bicycle";

        var nearest_fc = L.mapbox.featureLayer().setGeoJSON(turf.featurecollection([within, nearest])).addTo(map);

        nearest_fc.on('mouseover', function(e) {
            e.layer.openPopup();
        });
        nearest_fc.on('mouseout', function(e) {
            e.layer.closePopup();
        });

        nearest_fc.on('click', function(e){
                //remove layers
                map.removeLayer(marker);
                map.removeLayer(bufferLayer);
                map.removeLayer(nearest_fc);

                //save starting location
                start = turf.point(e.latlng.lng, e.latlng.lat);

                //highlight starting location
                start.properties["marker-color"] = '56b881';
                start.properties["marker-size"] = "large";
                start.properties["marker-symbol"] = "star";

                //update modal
                $('#start-location').removeClass('fill-white').addClass('fill-green');
                $('#start-location .content').hide();
                $('#start-location .label').text('start location');
                $('#start-location .selection').text(e.layer.feature.properties["name"]);
                //step2
                $('#destination').removeClass('fill-gray').addClass('fill-white');
                $('#destination .content').show();

                //show all points
                fc.features.forEach(function(feature){
                    feature.properties["marker-color"] = "C73E3E";
                    feature.properties["title"] = '<span></span><br>'+feature.properties["name"]+'<br>Bikes: '+feature.properties["nbBikes"]+'<br>Empty Docks: '+feature.properties["nbEmptyDocks"];
                    feature.properties["marker-size"] = "medium";
                    feature.properties["marker-symbol"] = "bicycle";
                })

                var all_stations = L.mapbox.featureLayer().setGeoJSON(fc).addTo(map);
                var startLayer = L.mapbox.featureLayer().setGeoJSON(turf.featurecollection([start])).addTo(map);

                //map on mousemove find nearest turf, distance from start
                var nearest_dest;
                var nearest_layer;
                map.on('mousemove', function(e){
                        //build point
                        var mouseLoc = turf.point(e.latlng.lng, e.latlng.lat);

                        //get distance from start to nearest, then update the modal
                        var route_dist = parseFloat(turf.distance(mouseLoc, start, 'miles'));
                        route_dist = route_dist.toFixed(2);
                        $('#distToStart').text(route_dist);

                        //if nearest hasn't changed, don't do anything
                        if ( nearest_dest && nearest_dest == turf.nearest(mouseLoc, fc) ) {
                        } else {
                        //remove last nearest
                        if( nearest_layer ) {
                            map.removeLayer(nearest_layer);
                        }

                        nearest_dest = turf.nearest(mouseLoc, fc);

                        nearest_dest.properties["marker-color"] = "C73E3E";
                        nearest_dest.properties["title"] = nearest.properties["name"]+'<br>Bikes: '+nearest.properties["nbBikes"]+'<br>Empty Docks: '+nearest.properties["nbEmptyDocks"];
                        nearest_dest.properties["marker-size"] = "large";
                        nearest_dest.properties["marker-symbol"] = "bicycle";

                        nearest_layer = L.mapbox.featureLayer().setGeoJSON(turf.featurecollection([nearest_dest])).addTo(map);

                        nearest_layer.on('mouseover', function(e) {
                            e.layer.openPopup();
                        });
                        nearest_layer.on('mouseout', function(e) {
                            e.layer.closePopup();
                        });

                        nearest_layer.on('click', function(e){
                                //remove all stations but the selected ones
                                map.removeLayer(all_stations);

                                //save starting location
                                destination = turf.point(e.latlng.lng, e.latlng.lat);

                                //highlight starting location
                                destination.properties["marker-color"] = '8a8acb';
                                destination.properties["marker-size"] = "large";
                                destination.properties["marker-symbol"] = "star";

                                var destinationLayer = L.mapbox.featureLayer().setGeoJSON(turf.featurecollection([destination])).addTo(map);

                                //update modal
                                $('#destination').removeClass('fill-white').addClass('fill-purple');
                                $('#destination .content').hide();
                                $('#destination .label').text('destination');
                                $('#destination .selection').text(e.layer.feature.properties["name"]);
                                //step2
                                $('#route-info').removeClass('fill-gray').addClass('fill-white');
                                $('#route-info .content').show();

                                map.removeEventListener('mousemove');

                                getRouteInfo(start,destination);
                        })

                        }
                })
        })
    }


    marker.on('drag', function(){updateVenues()});

    updateVenues();

    var elevProfile = []
    var queryPoints = []

    function getRouteInfo ( start, end ) {
        var startCoord = start.geometry.coordinates.toString();
        var endCoord = end.geometry.coordinates.toString();
        var directionsURL = 'https://api.tiles.mapbox.com/v4/directions/mapbox.cycling/'+ startCoord + ';' + endCoord +'.json?access_token=' + L.mapbox.accessToken;
        console.log(directionsURL);
        $.get(directionsURL, function(data){
                console.log(data);
                var route = data.routes[0].geometry;
                 var geoJSON = {
                     "type": "Feature",
                     "properties": {"stroke":"#3bb2d0",
                           "stroke-width":"3"}
                }
                geoJSON.geometry = route;
                var route_options = {
                    color: '#000'
                };

                //add route to map
                map.featureLayer.setGeoJSON(geoJSON);

                //update modal
                var distance = data.routes[0].distance * 0.000621371192;
                distance = distance.toFixed(2);
                $('#routedist').text(distance);

                //get surface deets
                makeSurfaceCall(route);
        });
    }

    function makeSurfaceCall ( points ) {
        points = points.coordinates;
        var pointString = '';
        points.forEach(function(arr){
            pointString = pointString + arr.toString() + ';';
        })
        pointString = pointString.slice(0, -1);
        var surfaceURL = 'https://api.tiles.mapbox.com/v4/surface/mapbox.mapbox-terrain-v2.json?layer=contour&fields=ele&points=' + pointString + '&access_token=' + L.mapbox.accessToken;
        $.get(surfaceURL, function(data){
            //create elevation profile
            var results = data.results;
            results.forEach(function(point) {
                elevProfile.push(point.ele);
                queryPoints.push([point.latlng.lat, point.latlng.lng]);
            })
            drawChart(elevProfile);
        })
    }

    function formatElev(elev) {
        return Math.round(elev) + ' m';
    }

    var hover = L.marker([], {
        icon: L.divIcon({
        className: 'marker-hover',
        iconSize: 20,
        iconAnchor: [10, 10]
        })
    });

    function drawChart ( elevData ) {
        $('#chart').html("");
        var hWind = $('.js-chartdiv').height();
        var wWind = $('.js-chartdiv').width();
        var minElev = d3.min(elevData);
        var maxElev = d3.max(elevData);
        $('#max-elev').text(formatElev(maxElev));
        $('#min-elev').text(formatElev(minElev));
        var margins = [20, 20, 20, 20],
            w = wWind - margins[1] - margins[3],
            h = hWind - margins[0] - margins[2];

        var x1 = d3.scale.linear()
            .domain([0, elevData.length])
            .range([0, w]);

        var y1 = d3.scale.linear()
            .domain([minElev - 10, d3.max(elevData) + 10])
            .range([h, 0]);

        var area = d3.svg.area()
            .x(function(d, i) {
                    return x1(i);
                    })
        .y0(h)
            .y1(function(d) {
                    return y1(d);
                    });
        //d3 goodness
        var graph = d3.select("#chart").append("svg:svg")
            .attr("width", w + margins[1] + margins[3])
            .attr("height", h + margins[0] + margins[2])
            .append("svg:g")
            .attr("transform", "translate(" + margins[3] + "," + margins[0] + ")")
            .on('mouseover', function() {
                    focusElev.style('display', null);
                    })
        .attr('class', 'profileGraph')
            .on('mouseout', function() {
                    focusElev.style('display', 'none');
                    map.removeLayer(hover);
                    })
        .on('mousemove', chartMouseover);

        graph.append("path")
            .attr("d", area(elevData))
            .attr('class', 'elevGraph');

        var focusElev = graph.append('g')
            .attr('class', 'focus')
            .style('display', 'none');

        focusElev.append('circle')
            .attr('r', 6)
            .attr('class', 'chart-elevation-circle')

        focusElev.append('text')
            .attr('x', 9)
            .attr('class', 'elev-text')
            .attr('dy', '.35em');

        function chartMouseover() {
                var x0 = x1.invert(d3.mouse(this)[0]);
                var y0 = elevData[Math.round(x0)];
                var hCoords = queryPoints[Math.round(x0)];
                hover.setLatLng([hCoords[0], hCoords[1]]);
                hover.addTo(map);
                focusElev.attr('transform', 'translate(' + x1(x0) + ',' + y1(y0) + ')');
                focusElev.select('text').text(elevData[Math.round(x0)] + ' meters');
            }
    }
});

$('.refresh').on('click', function(){
    document.location.reload(true);
})

getLocation();
marker.addTo(map);
