import { describe, it, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { cn } from "../app/lib/utils";
import { Button, buttonVariants } from "../app/components/ui/button";
import { Badge, badgeVariants } from "../app/components/ui/badge";
import { Input } from "../app/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "../app/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../app/components/ui/table";

describe("UI Primitives", () => {
  it("cn helper correctly merges tailwind classes", () => {
    expect(cn("px-2 py-1", "p-4")).toBe("p-4");
    expect(cn("text-red-500", false && "hidden", "font-bold")).toBe("text-red-500 font-bold");
  });

  it("buttonVariants generates pill classes with 50px height and primary color", () => {
    const primaryClasses = buttonVariants({ variant: "primary" });
    expect(primaryClasses).toContain("rounded-full");
    expect(primaryClasses).toContain("h-[50px]");
    expect(primaryClasses).toContain("bg-[#ff5e1f]");

    const secondaryClasses = buttonVariants({ variant: "secondary" });
    expect(secondaryClasses).toContain("rounded-full");
    expect(secondaryClasses).toContain("bg-[#262626]");

    const outlineClasses = buttonVariants({ variant: "outline" });
    expect(outlineClasses).toContain("rounded-full");
    expect(outlineClasses).toContain("border-[#f0f0f0]");
  });

  it("badgeVariants generates pill chip badge classes with cloudflare colors", () => {
    const badgeClasses = badgeVariants({ variant: "default" });
    expect(badgeClasses).toContain("rounded-full");
    expect(badgeClasses).toContain("bg-[#ff5e1f]");

    const secondaryClasses = badgeVariants({ variant: "secondary" });
    expect(secondaryClasses).toContain("bg-[#ffefe8]");
    expect(secondaryClasses).toContain("text-[#ff5e1f]");
  });

  it("renders Button and Input primitives with appropriate attributes", () => {
    const buttonHtml = renderToStaticMarkup(
      <Button variant="primary">Get Started</Button>
    );
    expect(buttonHtml).toContain("Get Started");
    expect(buttonHtml).toContain("bg-[#ff5e1f]");
    expect(buttonHtml).toContain("h-[50px]");

    const inputHtml = renderToStaticMarkup(
      <Input placeholder="Enter link" type="url" />
    );
    expect(inputHtml).toContain('placeholder="Enter link"');
    expect(inputHtml).toContain('type="url"');
    expect(inputHtml).toContain("rounded-full");
    expect(inputHtml).toContain("ring-[#ff5e1f]");
  });

  it("renders Card and Table primitives", () => {
    const cardHtml = renderToStaticMarkup(
      <Card>
        <CardHeader>
          <CardTitle>Analytics</CardTitle>
        </CardHeader>
        <CardContent>Body</CardContent>
      </Card>
    );
    expect(cardHtml).toContain("Analytics");
    expect(cardHtml).toContain("rounded-2xl");

    const tableHtml = renderToStaticMarkup(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Short URL</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>go.zulfifazhar.dev/xyz</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    expect(tableHtml).toContain("Short URL");
    expect(tableHtml).toContain("go.zulfifazhar.dev/xyz");
  });
});

