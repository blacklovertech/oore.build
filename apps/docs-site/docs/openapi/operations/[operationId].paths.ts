import { usePaths } from "vitepress-openapi";
import spec from "../../public/openapi.json";

export default {
  paths() {
    return usePaths({ spec })
      .getPathsByVerbs()
      .map((path) => ({
        params: {
          operationId: path.operationId,
          pageTitle: path.summary || path.operationId,
        },
      }));
  },
};
