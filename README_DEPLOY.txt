BabyFat Snow Team V7 Production

GAS backend:
https://script.google.com/macros/s/AKfycbxGUbFbAjcaHoQebNL-mnMOTRV1uLkeNogy5_ojZ36_S9ruB7H-JO1wFZ5xAuYsoiWYKw/exec

GitHub repository root should contain:
- wrangler.jsonc
- public/

Cloudflare build settings:
- Production branch: main
- Root directory: /
- Build command: none
- Deploy command: npx wrangler deploy

IMPORTANT
Do not upload this ZIP itself into the GitHub repo.
Extract it first, then upload/commit wrangler.jsonc and the public folder to the repository root.

After Cloudflare finishes deployment, test:
1. /system-check.html
2. 建立一筆測試預約
3. 在 Google Sheets 確認 Bookings 有新增資料
4. 用 我的預約 查詢訂單
5. 測試付款末五碼回填
6. 測試合作邀約
