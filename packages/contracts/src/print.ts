// §2.3 meta.print — validated (was unconstrained in v1).
//
// In v1 `meta` is an open object (extensions.schema.json:133); `print` is only
// clamped at read time in print.js:16-27. v2 validates it via Zod.
// getPrint/pageCss/pdfOptions (print.js) port KEEP verbatim downstream. Consumers:
// renderer usePageStyle (@page) + the bare print path + the Playwright PDF job.
import { z } from 'zod';

export const PAPER_SIZES = ['A4', 'Letter', 'Legal', 'A3', 'A5'] as const;

export const PrintConfig = z
  .object({
    paperSize: z.enum(PAPER_SIZES).default('A4'),
    margins: z
      .object({
        top: z.number().min(0).default(0),
        right: z.number().min(0).default(0),
        bottom: z.number().min(0).default(0),
        left: z.number().min(0).default(0),
      })
      // spec wrote `.default({})`; Zod v4 `.default` takes the OUTPUT type (all
      // fields required), so `{}` is rejected at compile time. `.prefault({})`
      // runs `{}` through parsing → identical fully-defaulted output. (Spec bug:
      // authored without a compiler.)
      .prefault({}),
    scale: z.number().positive().default(1),
  })
  .strict();
export type PrintConfig = z.infer<typeof PrintConfig>;
