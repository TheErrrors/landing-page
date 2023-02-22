import { Page } from "@playwright/test";

export class GUIPage {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    /// Uses a Referring Expression to find a component on the page
    async findElement(refExp: string, query: { [key: string]: string }) {
        // Take a screenshot of the browser viewport
        const img = await this.page.screenshot({
            path: "screenshots/refexp-screenshot.png",
        });

        // Send screenshot and referring expression to GuardianUI AI model
        const centerPoint = await this.refexpModelPredict({
            refexp: refExp,
            screenshot: img,
        });

        // Select component at predicted point
        const refExpMatched = await this.elementAtPoint({
            page: this.page,
            centerPoint: centerPoint,
            query: query,
        });

        return refExpMatched;
    }

    /// Requests the GuardianUI AI model to predict the coordinates of a component
    async refexpModelPredict({ refexp, screenshot }) {
        const b64img = "data:image/png;base64," + screenshot.toString("base64");
        console.debug(b64img.substring(0, 100));

        const response = await fetch(
          "https://guardianui-ui-refexp-click.hf.space/run/predict",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              data: [
                b64img, // "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==",
                refexp, // "select button xyz",
              ],
            }),
          }
        );

        if (response.status != 200) {
          console.error("Failed to fetch RefExp Click API", { response });
          const responseBodyText = await response.text();
          console.error({ responseBodyText });
          return undefined;
        }
        console.debug({ response });

        const rbody = response.body;
        console.debug({ rbody });

        const j = await response.json();
        const data = j.data;
        return data[1];
    }

    /// Selects a component at the given coordinates that matches an attribute
    async elementAtPoint({ page, centerPoint, query }) {
        const vpSize = await page.viewportSize();
        const cpTranslated = {
          x: vpSize?.width ? Math.round(centerPoint.x * vpSize?.width) : 0,
          y: vpSize?.height ? Math.round(centerPoint.y * vpSize?.height) : 0,
        };
        console.debug({ centerPoint, cpTranslated });
        // use predicted coordinates to verify against known data-testid label
        const match = await page.evaluate(
          ([cp, query]) => {
            const element = document.elementFromPoint(cp.x, cp.y);
            const attr = Object.keys(query)[0];
            const match = element?.getAttribute(attr) === query[attr];
            return match;
          },
          [cpTranslated, query]
        );
        console.debug({ match });
        return match;
    }
}