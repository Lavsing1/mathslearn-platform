MathsLearn Editor Workspace Upgrade
==================================

This add-on adds a Full screen / Exit full screen control to the Lecture Studio editor, improves responsive workspace layout, and keeps live preview visible instead of hiding it on smaller desktop screens.

Files:
- admin/studio/css/workspace-upgrade.css
- admin/studio/js/11-workspace-upgrade.js

Install in GitHub:
1. Upload both files to the exact paths shown above.
2. Open admin/studio/index.html and add this line AFTER the existing `<link rel="stylesheet" href="css/home.css">`:
   `<link rel="stylesheet" href="css/workspace-upgrade.css">`
3. In admin/studio/index.html, add this script line AFTER `<script src="js/10-mathslearn.js"></script>` and before `</body>`:
   `<script src="js/11-workspace-upgrade.js"></script>`
4. Commit to main and wait for Cloudflare Pages Production deployment to succeed.
5. Open `/admin/studio/index.html`, log in, open a lecture, and click **Full screen**.

Notes:
- The editor already has live preview and multiple colour/format buttons. This add-on does not replace the editor or change the database.
- Fullscreen browser permission can be denied by the browser; in that case it still uses the full viewport.
- On narrow screens the panels stack vertically to keep controls usable; on wide screens editor and preview sit side by side.
- These files have not been deployed to your live site yet.
