# Report Complex Example

This example creates a report workspace with multiple orders sharing the same resources. It is intended for testing the report website resource timeline and order filter.

```bash
npm run octoplanner -- workspace init
npm run octoplanner -- model requirement load --file examples/report-complex/requirements.json
npm run octoplanner -- model item load --file examples/report-complex/items.json
npm run octoplanner -- model routing load --file examples/report-complex/routings.json
npm run octoplanner -- model resource load --file examples/report-complex/resources.json
npm run octoplanner -- model supply load --file examples/report-complex/supplies.json
npm run octoplanner -- case create --name report-complex
npm run octoplanner -- plan create --case report-complex --name report-complex-plan
npm run build:report-web
npm run octoplanner -- report serve --lang zh-CN --port 5177
```

Open:

```text
http://127.0.0.1:5177/plans/report-complex-plan/timeline
```

The timeline contains multiple orders on the same Gantt-style resource view. Use the order filter above the timeline to show only one order at a time.
