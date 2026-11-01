export function MethodView() {
  return (
    <div className="evidence method">
      <section className="block">
        <h2>How a plan is made</h2>
        <ol className="plain">
          <li><b>Real places.</b> A snapshot of notable sights, parks and eateries from OpenStreetMap for each city (3.5 km around the centre).</li>
          <li><b>One walkable cluster.</b> The day is anchored on the densest group of important places within 2.2 km.</li>
          <li><b>Meals first.</b> Lunch is fixed in 11:45 to 14:00 (dinner 18:15 to 19:45 on food days), then stops are added one at a time where they cost the least walking per unit of importance.</li>
          <li><b>Every insertion is simulated</b> against opening hours for that date, walking time and the 09:00 to 21:00 window. Anything that does not fit is rejected.</li>
          <li><b>Unknown stays unknown.</b> Places without parseable opening hours can still appear, are ranked lower, and are labelled unverified.</li>
        </ol>
      </section>
      <section className="block">
        <h2>Assumptions you can change in code</h2>
        <table>
          <tbody>
            <tr><th scope="row">Walking speed</th><td>4.8 km/h</td></tr>
            <tr><th scope="row">Street distance</th><td>straight line x 1.3</td></tr>
            <tr><th scope="row">Visit lengths</th><td>museum 90 min, castle 60, park 50, viewpoint 25, restaurant 70, cafe 35 and so on (src/core/catalog.ts)</td></tr>
            <tr><th scope="row">Importance</th><td>category base score plus a bonus for a Wikidata link. OpenStreetMap has no ratings.</td></tr>
            <tr><th scope="row">Dates</th><td>Opening hours are evaluated for the date you choose. Public and school holidays are not modelled.</td></tr>
          </tbody>
        </table>
      </section>
      <section className="block">
        <h2>Limits</h2>
        <ul className="plain">
          <li>Opening hours in OpenStreetMap are incomplete and sometimes out of date. A green mark means the tagged hours allow the visit, not that the venue confirmed it.</li>
          <li>No ticket availability, queues, temporary closures or quality. Restaurants are chosen by position and tagged hours, not by taste.</li>
          <li>Walking time is estimated, not routed. The evaluation reports how far off that is.</li>
          <li>Coverage is 12 city centres. Outside them there is no data in this build.</li>
        </ul>
      </section>
      <section className="block">
        <h2>Data</h2>
        <p>Map data © OpenStreetMap contributors, available under the Open Database Licence. Basemap © OpenFreeMap and OpenMapTiles. Snapshots were fetched through the Overpass API; each file records its fetch time.</p>
      </section>
    </div>
  );
}
