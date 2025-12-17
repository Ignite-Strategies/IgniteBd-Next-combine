import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "@/lib/uploadthing/core";

// Route handlers can only export HTTP methods (GET, POST, etc.)
export const { GET, POST } = createRouteHandler({ router: ourFileRouter });

