/**
 * GET /api/portfolio/deploy/status
 *
 * Re-export the GET handler from the parent deploy route.
 * The client polls this endpoint every 5 s to check deployment status.
 */
export { GET } from "../route";
