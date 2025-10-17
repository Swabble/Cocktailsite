import { buildMasterData } from "../master-data";
import { parseIngredientLine } from "../parser";

const masterData = buildMasterData([
  {
    Cocktail: "Test",
    Rezeptur: "2 cl Bacardi, 1 Dash Angostura, Filler Maracuja, - handvoll Minze",
    Gruppe: "Test",
    Deko: "",
    Glas: "",
    Zubereitung: ""
  }
]);

describe("parseIngredientLine", () => {
  it("parses quantities with cl", () => {
    const parsed = parseIngredientLine("2 cl Bacardi", masterData);
    expect(parsed.amount).toBe(2);
    expect(parsed.unit).toBe("cl");
    expect(parsed.ingredient).toBe("Bacardi");
    expect(parsed.statuses.unit).toBe("ok");
  });

  it("parses dash with fuzzy ingredient", () => {
    const parsed = parseIngredientLine("1 Dash Angostora", masterData);
    expect(parsed.unit).toBe("Dash");
    expect(parsed.ingredient).toBe("Angostura Bitters");
    expect(["ok", "fuzzy"]).toContain(parsed.statuses.ingredient);
  });

  it("handles filler without amount", () => {
    const parsed = parseIngredientLine("Filler Maracuja", masterData);
    expect(parsed.unit).toBe("Filler");
    expect(parsed.ingredient).toMatch(/Maracuja/i);
    expect(parsed.amount).toBeNull();
  });

  it("parses percent filler", () => {
    const parsed = parseIngredientLine("50% Filler maracuja", masterData);
    expect(parsed.amount).toBe(50);
    expect(parsed.unit).toBe("Filler");
    expect(parsed.ingredient).toMatch(/maracuja/i);
  });

  it("handles dash with empty amount", () => {
    const parsed = parseIngredientLine("- handvoll Minze", masterData);
    expect(parsed.amount).toBeNull();
    expect(parsed.amountText).toBe("-");
    expect(parsed.unit).toMatch(/handvoll/i);
    expect(parsed.ingredient).toBe("Minze");
  });

  it("marks ambiguous ranges", () => {
    const parsed = parseIngredientLine("1-2 TL Zuckersirup", masterData);
    expect(parsed.amount).toBeNull();
    expect(parsed.amountText).toBe("1-2");
    expect(parsed.statuses.amount).toBe("ambiguous");
  });

  it("parses unicode fractions", () => {
    const parsed = parseIngredientLine("½ EL Limettensaft (frisch)", masterData);
    expect(parsed.amount).toBeCloseTo(0.5);
    expect(parsed.notes).toContain("frisch");
    expect(parsed.ingredient).toMatch(/Limettensaft/);
  });

  it("is robust against missing whitespace", () => {
    const parsed = parseIngredientLine("2cl   Bacardi", masterData);
    expect(parsed.amount).toBe(2);
    expect(parsed.unit).toBe("cl");
    expect(parsed.ingredient).toBe("Bacardi");
  });
});
