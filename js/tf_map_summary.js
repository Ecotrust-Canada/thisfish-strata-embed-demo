$( document ).ready(function() {
     var host = "http://stage.thisfish.info";

     $( "form #tf" ).on( "click", function() {
       console.log("Click to get results");
       get_trace(host);return false;
     });

     function readGeomPoint(geom){
       var regex = /[+-]?\d+(\.\d+)?/g,
	   bits = geom.match(regex).map(function(v) { return parseFloat(v); });
       return {x: bits[1], y: bits[2]};    
     }

     function get_trace(host) {
       var search_code = $("input#code").val();

       var request = $.getJSON(host + "/api/trace/?code="+search_code, function( data, status, xhr ){
	 console.log("Got results:");
	 console.log(data);
	 if (status == "success"){
	   if (data.fh_events && data.fh_events.length){
	     var results_bits = [
	       "<p>Your ", data.fish.name," was harvested by ",
	       data.fh_events[0].user, " ",
	       data.fh_events[0].stat_area.description,
	       " and landed ",  data.fh_events[0].product_state.name," in ",
	       data.fh_events[0].landing_location.name,"</p>"
	     ];  
	     $( ".summary" ).html(results_bits.join(''));

	     var TRACE = {
		 caught_label: 'Harvested',
		 language: 'en',
		 locations: []
	     };
	     var ev, i, len, coords;
	     for(i=0, len=data.fh_events.length; i<len; i++){
	       ev = data.fh_events[i];
	       coords = readGeomPoint(ev.landing_location.location);
	       TRACE.landing = {
		   geom: ev.landing_location.location,
		   x: coords.x,
		   y: coords.y,
		   label: "Landed in <br/> <b>"+ev.landing_location.name+"</b>",
		   name: ev.landing_location.name,
		   date: ev.ship_date,
		   radius: ev.landing_location.radius || 0,
		   id: "landed"
	       };
	       TRACE.caught = {
		   name: ev.stat_area.description,
		   mgnt_area: ev.stat_area.id || 0,
		   date: ev.receipt_date,
		   id: "caught"
	       };
	     }
	     for(i=0, len=data.ind_events.length; i<len; i++){
	       ev = data.ind_events[i];
	       
	       if (ev.location){
		 coords = readGeomPoint(ev.location.geocode_cache);
		 TRACE.locations.push({
		   name: ev.location.name,
		   geom:  ev.location.geocode_cache,
		   x: coords.x,
		   y: coords.y,
		   date: ev.ship_date,
		   id: ev.group && ev.group.name || 'unknown',
		   label: "<br/> in <b>"+ev.location.name+"</b>"
		 });
		 
	       }
	     }

	     var map = L.map('map').setView([51.505, -0.09], 13);

	     L.tileLayer('http://{s}.tiles.mapbox.com/v4/mapbox.streets/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoiZWNvdHJ1c3QiLCJhIjoibGo4TG5nOCJ9.QJnT2dgjL4_4EA7WlK8Zkw', {
		 maxZoom: 18,
		 attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
		     '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
		     'Imagery © <a href="http://mapbox.com">Mapbox</a>',
		 id: 'examples.map-i875mjb7'
	     }).addTo(map);
	     var radius_km = TRACE.landing.radius * 1000;


	     var landingcircle = L.circle([TRACE.landing.y, TRACE.landing.x], radius_km ,
		 {
		     color:'#2D6A7D',
		     fillColor:'#F0630B',
		     opacity:'.8',
		     fillOpacity:'.4',
		     dashArray: '5,5',
		     weight: '1'
		 })
		 .addTo(map);


	     var landing = L.circleMarker([TRACE.landing.y, TRACE.landing.x],
		 {   radius:9,
		     weight:7,
		     color:'#F0630B',
		     fillColor:'#19181A',
		     opacity:'.5',
		     fillOpacity:'.6'
		 })
		 .bindLabel(TRACE.landing.label,{ noHide: true,direction: 'right',offset:[12,12] });

	     $.ajax({
		 url: host+"/fishery/mgnt_area/"+TRACE.caught.mgnt_area+"/",
		 callback: "leafletJsonpCallback",
		 jsonpCallback: "leafletJsonpCallback",
		 dataType: "jsonp"
	     });


	     var myStyle = {
		 "color": "#ff7800",
		 "weight": 5,
		 "opacity": 0.65
	     };

	     function getExtent(_) {
		 var bbox = [Infinity, Infinity, -Infinity, -Infinity],
		     ext = extent(),
		     coords = geojsonCoords(_);
		 for (var i = 0; i < coords.length; i++) ext.include(coords[i]);
		 return ext;
	     }

	     leafletJsonpCallback = function(rsp) {
		 var myStyle = {
		     'color':'#2D6A7D',
		     'fillColor':'#F0630B',
		     'opacity':'.8',
		     'fillOpacity':'.4',
		     'dashArray': '5,5',
		     'weight': '0'
		 };

		 //var mgnt_area = L.geoJson(rsp.features[0], {style:myStyle});


		 var mgnt_area = L.geoJson(rsp.features[0], {
		       style:myStyle, 
		       coordsToLatLng: function (coords) {
			 var a = coords[0];
			 var b = coords[1];
			 coords[0] = b;
			 coords[1] = a;
			 if (TRACE.landing.x < 0){
			     if (a > 0){
				 coords[1] = a-360;
			     }
			 }
			 return coords;
		       }
		     });


		  mgnt_area.addTo(map);
		  

		  var pointList = [mgnt_area.getBounds().getCenter(), landing.getLatLng()];

		  var firstpolyline = new L.Polyline(pointList, {
		    color: '#FA8500',
		    weight: 3,
		    opacity: 0.9,
		    smoothFactor: 1,
		  });
		  


		  var group = new L.featureGroup([landing]);
		  var bounds = mgnt_area.getBounds();
		  bounds.extend(landing.getLatLng());

		  var locations = TRACE.locations;
		  for (i=0;i<locations.length;i++){
		      var location = locations[i];
		      if (location.x && location.y){
			  firstpolyline.addLatLng([location.x, location.y]);
			  var process = L.circleMarker([location.x, location.y],
			  {   
			    radius:9,
			    weight:7,
			    color:'#F0630B',
			    fillColor:'#19181A',
			    opacity:'.5',
			    fillOpacity:'.6'
			  })
			  .bindLabel(location.label,{ noHide: true,direction: 'right',offset:[12,-45] }).addTo(map);
			  bounds.extend(process.getLatLng());
		      }
		  }


		  landing.addTo(map);
		  map.fitBounds(bounds, {padding: [50,50]});
		  firstpolyline.addTo(map);

		  label = new L.Label({direction: 'right', offset:[50,-100]});
		  label.setContent(TRACE.caught_label + '<br><b>' + rsp.features[0].properties.description + '</b>');
		  label.setLatLng(map.getBounds().getSouthWest());
		  map.showLabel(label);

		  map.on('zoomend', function() { 
		      label.setLatLng(map.getBounds().getSouthWest());
		  });
		  map.on('dragend', function() { 
		      label.setLatLng(map.getBounds().getSouthWest());
		  });
	     }
	   } else {
	    var summary_bits = [
	      "<div id='codeinfo'>",
	      "<div id='communicatecatch'>",
	      "<h2>","Sorry!","</h2>",
	      "<p>Your fish harvester or supplier hasn't yet uploaded all their catch info. ",
	      "Send us a message  and ThisFish will contact them for more details. ",
	      "Thanks for your patience and cooperation.",
	      "</p></div>",
	      "</div>"
	    ];  
	    $( "#tf_results" ).html(summary_bits.join(''));
	   }
	 }
       })
       .error(function(jqXHR, textStatus, errorThrown) {
	  console.log("error " + textStatus);
	  console.log("incoming Text " + jqXHR.responseText);
	  var summary_bits = [
	    "<div id='communicatecatch'>",
	    "<h2>","Oops! This code is invalid","</h2>",
	    "<p>We don’t recognize this code. Double check and try again.",
	    "</p></div>"
	  ];  
	  $( "#tf_results" ).html(summary_bits.join(''));
	});
     }
});
