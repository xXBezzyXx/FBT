INVOICE LOGO PDF FIX

Logo location: xXBezzyXx/FBT/images/logo.png on the main branch.

Replace Code.gs in Google Apps Script. Deploy > Manage deployments > Edit > New version > Deploy.
Replace script.js in GitHub to remove the unnecessary automatic sync request.

The PDF generator now downloads the logo directly from GitHub; no logo URL field or sync is needed. The old 2 MB restriction has been raised to 10 MB. Generate a NEW PDF to test; existing PDFs do not change.
