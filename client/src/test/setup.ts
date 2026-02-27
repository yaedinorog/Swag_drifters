import { vi } from "vitest";

class StorageMock {
  private store = new Map<string, string>();

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }
}

const localStorageMock = new StorageMock();
const sessionStorageMock = new StorageMock();

vi.stubGlobal("localStorage", localStorageMock);
vi.stubGlobal("sessionStorage", sessionStorageMock);

if (!globalThis.fetch) {
  vi.stubGlobal("fetch", vi.fn());
}

type Handler = (...args: unknown[]) => void;

class MockGameObject {
  private handlers = new Map<string, Handler[]>();

  setOrigin(): this {
    return this;
  }

  setInteractive(): this {
    return this;
  }

  setText(): this {
    return this;
  }

  setScrollFactor(): this {
    return this;
  }

  setDepth(): this {
    return this;
  }

  setTint(): this {
    return this;
  }

  setScale(): this {
    return this;
  }

  setAlpha(): this {
    return this;
  }

  setRotation(): this {
    return this;
  }

  setStrokeStyle(): this {
    return this;
  }

  setFillStyle(): this {
    return this;
  }

  setPosition(): this {
    return this;
  }

  setDisplaySize(): this {
    return this;
  }

  setColor(): this {
    return this;
  }

  on(event: string, handler: Handler, context?: unknown): this {
    const list = this.handlers.get(event) ?? [];
    const bound = context ? handler.bind(context) : handler;
    list.push(bound);
    this.handlers.set(event, list);
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    const list = this.handlers.get(event) ?? [];
    list.forEach((handler) => handler(...args));
  }

  destroy(): void {
    this.handlers.clear();
  }
}

class MockGraphics extends MockGameObject {
  lineStyle(): this {
    return this;
  }

  strokePoints(): this {
    return this;
  }

  fillRect(): this {
    return this;
  }

  fillPoints(): this {
    return this;
  }

  lineBetween(): this {
    return this;
  }

  beginPath(): this {
    return this;
  }

  moveTo(): this {
    return this;
  }

  lineTo(): this {
    return this;
  }

  closePath(): this {
    return this;
  }

  fill(): this {
    return this;
  }

  stroke(): this {
    return this;
  }

  arc(): this {
    return this;
  }
}

class MockContainer extends MockGameObject {
  private children: MockGameObject[] = [];

  add(items: MockGameObject | MockGameObject[]): this {
    if (Array.isArray(items)) {
      this.children.push(...items);
    } else {
      this.children.push(items);
    }
    return this;
  }

  getAt(index: number): MockGameObject | undefined {
    return this.children[index];
  }
}

class MockKeyboard {
  private handlers = new Map<string, Handler[]>();

  addKey(): { isDown: boolean } {
    return { isDown: false };
  }

  on(event: string, handler: Handler, context?: unknown): void {
    const list = this.handlers.get(event) ?? [];
    list.push(context ? handler.bind(context) : handler);
    this.handlers.set(event, list);
  }

  off(event: string, handler?: Handler): void {
    if (!handler) {
      this.handlers.delete(event);
      return;
    }
    const list = this.handlers.get(event) ?? [];
    this.handlers.set(event, list.filter((item) => item !== handler));
  }

  once(event: string, handler: Handler, context?: unknown): void {
    const wrapped = (...args: unknown[]) => {
      this.off(event, wrapped);
      (context ? handler.bind(context) : handler)(...args);
    };
    this.on(event, wrapped);
  }

  emit(event: string, ...args: unknown[]): void {
    (this.handlers.get(event) ?? []).forEach((handler) => handler(...args));
  }

  removeAllListeners(): void {
    this.handlers.clear();
  }
}

class MockScene {
  add = {
    text: () => new MockGameObject(),
    rectangle: () => new MockGameObject(),
    graphics: () => new MockGraphics(),
    container: () => new MockContainer(),
    sprite: () => new MockGameObject()
  };

  input = {
    keyboard: new MockKeyboard()
  };

  cameras = {
    main: {
      width: 1280,
      height: 720,
      zoom: 1,
      scrollX: 0,
      scrollY: 0,
      centerOn: vi.fn(),
      setZoom: vi.fn(),
      setBackgroundColor: vi.fn()
    },
    add: vi.fn().mockReturnValue({
      setScroll: vi.fn(),
      ignore: vi.fn()
    })
  };

  scene = {
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    launch: vi.fn(),
    stop: vi.fn(),
    isPaused: vi.fn().mockReturnValue(false),
    isActive: vi.fn().mockReturnValue(false)
  };

  time = {
    now: 0
  };

  events = {
    once: vi.fn()
  };

  make = {
    graphics: vi.fn().mockReturnValue(new MockGraphics())
  };
}

const PhaserMock = {
  AUTO: 0,
  Scene: MockScene,
  Math: {
    Linear: (a: number, b: number, t: number) => a + (b - a) * t
  },
  Geom: {
    Point: class {
      constructor(public x: number, public y: number) {}
    }
  },
  Input: {
    Keyboard: {
      KeyCodes: {
        W: 0,
        UP: 1,
        S: 2,
        DOWN: 3,
        A: 4,
        LEFT: 5,
        D: 6,
        RIGHT: 7,
        SPACE: 8,
        R: 9,
        ESC: 10,
        ENTER: 11,
        P: 12
      },
      JustDown: () => false
    }
  },
  Scale: {
    FIT: 0,
    CENTER_BOTH: 0
  },
  GameObjects: {
    Text: MockGameObject,
    Image: MockGameObject,
    Sprite: MockGameObject,
    Rectangle: MockGameObject,
    Container: MockContainer
  }
};

vi.mock("phaser", () => ({
  default: PhaserMock
}));
