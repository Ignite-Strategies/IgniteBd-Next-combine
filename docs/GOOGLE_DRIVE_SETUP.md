# Google Drive Setup for Blog Exports

## Problem
When exporting blogs to Google Docs, the system uses a Google service account. By default, documents are created in the service account's personal Drive, which has a **15GB free storage limit**.

Once this limit is reached, you'll see: **"Drive storage exceeded"** error.

## Solution
Configure the system to save blog exports to a **shared folder** with more storage space.

---

## Setup Steps

### 1. Get the Service Account Email
The service account email is in your `GOOGLE_SERVICE_ACCOUNT_JSON` environment variable. It looks like:
```
your-service-account@project-id.iam.gserviceaccount.com
```

### 2. Create or Choose a Folder in Google Drive
- Go to [Google Drive](https://drive.google.com)
- Create a new folder (e.g., "Ignite Blog Exports") or use an existing folder
- This folder should be in a Google Workspace account with sufficient storage

### 3. Share the Folder with the Service Account
- Right-click the folder → **Share**
- Add the service account email (from step 1)
- Give it **Editor** permissions
- Click **Send**

### 4. Get the Folder ID
- Open the folder in Google Drive
- Look at the URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`
- Copy the `FOLDER_ID_HERE` part

### 5. Set the Environment Variable
Add this to your environment variables (`.env` or hosting platform):

```bash
GOOGLE_DRIVE_BLOG_FOLDER_ID=your_folder_id_here
```

### 6. Restart the Application
Restart your server to pick up the new environment variable.

---

## How It Works

**Before configuration:**
- Blogs are created in: Service Account's Root Drive (15GB limit)
- URL: `https://docs.google.com/document/d/DOC_ID/edit`

**After configuration:**
- Blogs are created in: Your Shared Folder (workspace storage limit)
- URL: `https://docs.google.com/document/d/DOC_ID/edit` (same format, different location)

---

## Troubleshooting

### "Storage exceeded" error persists
- Verify the folder ID is correct
- Ensure the service account has **Editor** (not just Viewer) permissions
- Check that the environment variable is set and the server was restarted

### Can't find the service account email
Check your environment variables or ask your admin for the `GOOGLE_SERVICE_ACCOUNT_JSON` value.

### Want to clean up old documents
1. Open the service account's Drive (if you have access)
2. Or check the shared folder and delete old/test documents
3. Empty the trash to free up space

---

## Alternative Solutions

### Option 1: Upgrade Service Account Storage
If you're using Google Workspace, you can add the service account to your organization and it will use your workspace storage quota.

### Option 2: Use User OAuth Instead
Instead of a service account, use OAuth to create docs in the user's personal Drive. This requires more complex authentication setup.

### Option 3: Shared Drive (Team Drive)
Use a Google Shared Drive for unlimited organizational storage (requires Google Workspace Business or higher).

---

## Current Implementation

The code checks for `GOOGLE_DRIVE_BLOG_FOLDER_ID`:
- **If set**: Creates docs in the specified folder
- **If not set**: Creates docs in service account root (logs a warning)

See: `app/api/content/blog/[id]/push-to-google-docs/route.js`
