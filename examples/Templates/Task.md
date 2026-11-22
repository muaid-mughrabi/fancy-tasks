---
kind: task
status: todo
type:
stage:
deadline:
tags: []
---

## Dates

Calendar dates live in Google Calendar. Open the event in the Full Calendar view,
choose **Open Note**, and set `task` in that note to link this task; it then shows up here.

```base
filters:
  and:
    - file.hasLink(this.file)
    - file.inFolder("Calendar")
views:
  - type: table
    name: Dates
```
