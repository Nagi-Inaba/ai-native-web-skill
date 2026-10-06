"use client";

const chart = "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20200%20100%22%3E%3Crect%20x%3D%2220%22%20y%3D%2255%22%20width%3D%2250%22%20height%3D%2240%22%20fill%3D%22%23234%22%2F%3E%3Crect%20x%3D%22110%22%20y%3D%2225%22%20width%3D%2250%22%20height%3D%2270%22%20fill%3D%22%23234%22%2F%3E%3C%2Fsvg%3E";
const decoration = "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2016%2016%22%3E%3Ccircle%20cx%3D%228%22%20cy%3D%228%22%20r%3D%226%22%20fill%3D%22%23234%22%2F%3E%3C%2Fsvg%3E";

export default function DataTableAndImages() {
  return (
    <main>
      <h1><img src={decoration} alt="" width="16" height="16" /> Completed tasks</h1>
      <figure>
        <img src={chart} alt="Completed tasks by month; exact values are in the table." width="200" height="100" />
        <figcaption>Completed tasks increased from 4 in April to 7 in May.</figcaption>
      </figure>
      <table>
        <caption>Completed tasks by month</caption>
        <thead><tr><th scope="col">Month</th><th scope="col">Completed tasks</th></tr></thead>
        <tbody>
          <tr><th scope="row">April</th><td>4</td></tr>
          <tr><th scope="row">May</th><td>7</td></tr>
        </tbody>
      </table>
    </main>
  );
}
