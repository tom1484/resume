// §2.3 meta.print — validated via Zod.
//
// getPrint/pageCss/pdfOptions consume it downstream. Consumers: renderer
// usePageStyle (@page) + the bare print path + the Playwright PDF job.
import { z } from 'zod';

export const PAPER_SIZES = ['A4', 'Letter', 'Legal', 'A3', 'A5'] as const;

/**
 * Physical paper dimensions in millimetres (portrait), keyed by PAPER_SIZES.
 * Co-located with PAPER_SIZES (the canonical list getPrint validates against)
 * so the names and their dimensions can never drift. Used by the on-screen
 * paper-accurate preview to size the page (mm→px via mmToPx) and lay out
 * margins/scale; the browser/Playwright handle the actual PDF dimensions from
 * the size NAME, so this is preview-only.
 */
export const PAPER_DIMENSIONS: Record<
  (typeof PAPER_SIZES)[number],
  { width: number; height: number }
> = {
  A4: { width: 210, height: 297 },
  Letter: { width: 215.9, height: 279.4 },
  Legal: { width: 215.9, height: 355.6 },
  A3: { width: 297, height: 420 },
  A5: { width: 148, height: 210 },
};

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
