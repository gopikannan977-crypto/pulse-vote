# Demo checklist

1. Start with two browser windows.
2. Sign up in window A.
3. Create a poll with 3 options.
4. Copy the poll link.
5. Open the link in window B/incognito.
6. Vote from window B.
7. Keep window A on the poll — the bar should change without refresh.
8. Open another tab and vote again with a different browser/localStorage.
9. Show the Studio controls: close/reopen and delete.
10. In the video, explain that MongoDB persists votes while Redis performs atomic live counting + Pub/Sub, and WebSocket delivers the update.
