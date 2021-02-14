import axios from 'axios';
import { $ } from './bling';

const mapOptions = {
    center: {lat: 43.2, lng: -79.8 },
    zoom: 10,
}
function loadPlaces(map, lat = 43.2, lng = -79.8){
    // navigator.geolocation.getCurrentPosition  // Day 21 on JS30 to implement the position of the user instead of having a hardcoded default location
    axios.get(`/api/stores/near?lat=${lat}&lng=${lng}`)
        .then(res => {
            const places = res.data;
            if(!places.length) {
                alert('no places found!');
                return;
            }
            // create bounds for the map
            const bounds = new google.maps.LatLngBounds();
            const infoWindow = new google.maps.InfoWindow();

            const markers = places.map(place => { // create a marker for each of the found locations
                const [placeLng, placeLat] = place.location.coordinates;
                // console.log(placeLng, placeLat) 
                const position = { lat: placeLat, lng: placeLng }
                bounds.extend(position);
                const marker = new google.maps.Marker({ map, position });
                marker.place = place; // set the place property equal to our data for that location so we can use that when a marker is clicked
                return marker;
            });
            console.log(markers);

            // when someone clicks a marker show the details of that place
            markers.forEach(marker => marker.addListener('click', function() {
                const html = `
                    <div class="popup">
                        <a href="/store/${this.place.slug}">
                            <img src="/uploads/${this.place.photo || 'store.png'}" alt="${this.place.name}" />
                            <p>${this.place.name} - ${this.place.location.address}</p>
                        </a>
                    </div>
                `
                infoWindow.setContent(html);
                infoWindow.open(map, this)
                console.log(this.place);
            }));

            // then zoom the map to fit the markers perfectly
            map.setCenter(bounds.getCenter());
            map.fitBounds(bounds);
        });

}

function makeMap(mapDiv) {
    if(!mapDiv) return; // stop the function from running when there is no mapDiv present (when the user visits another page then the /map route)
    // make our map
    const map = new google.maps.Map(mapDiv, mapOptions);
    loadPlaces(map);
    const input = $('[name="geolocate"]');
    const autocomplete = new google.maps.places.Autocomplete(input);
    autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        // console.log(place); 
        loadPlaces(map, place.geometry.location.lat(), place.geometry.location.lng());
    })
}

export default makeMap;