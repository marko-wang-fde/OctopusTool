# Plain HTML Example

Open `index.html` in a browser after replacing:

- `YOUR_STATION_ID`
- `/api/octopus/embed-access-token`

This example demonstrates:

- inline embed
- `getEmbedAccessToken`
- `readCurrentDocument`
- `saveCurrentDocument`

The host backend endpoint should not sign the `embedAccessToken` itself.
It should call octopus Host with the station server API key and return:

```json
{
  "embedAccessToken": "eat_xxx"
}
```
