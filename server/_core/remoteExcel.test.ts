import { afterEach, describe, expect, it, vi } from "vitest";
import { parseStudentsWorkbookRemote } from "./remoteExcel";

const ORIGINAL_ENV = { ...process.env };
const SECRET = "test-excel-secret";

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("remote Excel client", () => {
  it("sends workbook data to the configured Excel service with the shared secret", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          sheetName: "import",
          rows: [],
          errors: [],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    process.env.EXCEL_SERVICE_URL = "https://excel-service.example.com/";
    process.env.EXCEL_SERVICE_SECRET = SECRET;

    const result = await parseStudentsWorkbookRemote({
      fileName: "students.xlsx",
      fileContentBase64: "abc123",
    });

    expect(result).toEqual({ sheetName: "import", rows: [], errors: [] });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://excel-service.example.com/api/excel/student-import",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-excel-service-secret": SECRET,
        },
        body: JSON.stringify({
          fileName: "students.xlsx",
          fileContentBase64: "abc123",
        }),
      }
    );
  });
});
