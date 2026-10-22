-- Authors no longer wait for an admin: everyone still pending from the old flow is activated.
UPDATE "User" SET "authorStatus" = 'APPROVED' WHERE "role" = 'AUTHOR' AND "authorStatus" = 'PENDING';
