import React, { useRef, useState } from "react";
import { Button, CapsuleButton, Menu, PopoverMorph, Tooltip } from "@pal/ui";
import { Pin, PinOff, Puzzle, ExternalLink, Settings2 } from "lucide-react";
import type { WebPreviewCommand, WebPreviewState } from "@pal/contracts";
import type { messages } from "./messages";

export type BrowserExtension = NonNullable<
  WebPreviewState["extensions"]
>[number] & {
  pinned?: boolean;
  icon?: string;
  hasPopup?: boolean;
  hasOptions?: boolean;
};
export interface ExtensionsProps {
  extensions: BrowserExtension[];
  available: boolean;
  text: ReturnType<typeof messages>;
  execute(command: WebPreviewCommand): Promise<unknown>;
  fail(error: unknown): void;
  confirmRemove(extension: BrowserExtension): Promise<boolean>;
}
export function extensionLabels(text: ExtensionsProps["text"]) {
  const zh = text.extensions !== "Extensions";
  return zh
    ? {
        manage: "管理扩展程序",
        store: "访问 Chrome 应用商店",
        pin: "固定到工具栏",
        unpin: "从工具栏取消固定",
        more: "更多选项",
        options: "扩展选项",
        disable: "停用",
        enable: "启用",
        search: "搜索扩展程序",
        details: "详情",
        back: "返回浏览器",
      }
    : {
        manage: "Manage extensions",
        store: "Visit Web Store",
        pin: "Pin to toolbar",
        unpin: "Unpin from toolbar",
        more: "More options",
        options: "Extension options",
        disable: "Disable",
        enable: "Enable",
        search: "Search extensions",
        details: "Details",
        back: "Back to browser",
      };
}
export function ExtensionIcon({ extension }: { extension: BrowserExtension }) {
  const [failed, setFailed] = useState(false);
  return extension.icon && !failed ? (
    <img
      className="browser-extension-icon"
      src={extension.icon}
      alt=""
      onError={() => setFailed(true)}
    />
  ) : (
    <Puzzle className="browser-extension-icon" aria-hidden="true" />
  );
}
export function extensionAnchor(element: HTMLElement) {
  const bounds = element.getBoundingClientRect();
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
}
export function ExtensionsMenu(
  props: ExtensionsProps & {
    onManage(): void;
    onVisitStore(): void;
    onOpenChange?(open: boolean): void;
  },
) {
  const {
    extensions,
    available,
    text,
    execute,
    fail,
    confirmRemove,
    onManage,
    onVisitStore,
  } = props;
  const labels = extensionLabels(text);
  const anchor = useRef<HTMLButtonElement>(null);
  const popupAnchor = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const changeOpen = (value: boolean) => {
    setOpen(value);
    props.onOpenChange?.(value);
  };
  const run = async (command: WebPreviewCommand) => {
    setBusy(true);
    try {
      await execute(command);
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };
  const launch = (
    extension: BrowserExtension,
    element: HTMLElement,
    options = false,
  ) => {
    changeOpen(false);
    void run({
      type: "extension-open",
      id: extension.id,
      options,
      anchor: extensionAnchor(element),
    });
  };
  return (
    <div className="browser-extensions-toolbar">
      {extensions
        .filter((extension) => extension.pinned && extension.enabled)
        .slice(0, 3)
        .map((extension) => (
          <Tooltip key={extension.id} content={extension.name}>
            <CapsuleButton
              className="browser-extension-toolbar-button"
              disabled={busy || !available}
              aria-label={extension.name}
              onClick={(event) => launch(extension, event.currentTarget)}
            >
              <ExtensionIcon extension={extension} />
            </CapsuleButton>
          </Tooltip>
        ))}
      <Tooltip content={text.extensions}>
        <CapsuleButton
          ref={anchor}
          className="browser-extension-toolbar-button"
          aria-label={text.extensions}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => changeOpen(!open)}
        >
          <Puzzle size={16} />
        </CapsuleButton>
      </Tooltip>
      <span
        ref={popupAnchor}
        className="browser-extensions-menu-anchor"
        aria-hidden="true"
      />
      <PopoverMorph
        open={open}
        onOpenChange={(value) => {
          if (value || !submenuOpen) changeOpen(value);
        }}
        anchor={popupAnchor.current}
        align="start"
        className="mu-menu-popover browser-extensions-popover"
      >
        <div className="browser-extensions-menu-heading">
          {text.extensions} ({extensions.length})
        </div>
        {!available && (
          <p className="browser-extensions-menu-status">
            {text.extensionUnavailable}
          </p>
        )}
        {extensions.length === 0 && (
          <p className="browser-extensions-menu-status">
            {text.extensionEmpty}
          </p>
        )}
        <div className="browser-extensions-menu-list">
          {extensions.map((extension) => (
            <div key={extension.id} className="browser-extensions-menu-row">
              <Tooltip content={extension.name}>
                <Button
                  className="browser-extension-launch"
                  variant="ghost"
                  size="small"
                  disabled={busy || !available || !extension.enabled}
                  onClick={(event) => launch(extension, event.currentTarget)}
                >
                  <ExtensionIcon extension={extension} />
                  <span>{extension.name}</span>
                </Button>
              </Tooltip>
              <Tooltip content={extension.pinned ? labels.unpin : labels.pin}>
                <Button
                  className="browser-extension-pin"
                  variant="ghost"
                  size="small"
                  aria-label={extension.pinned ? labels.unpin : labels.pin}
                  aria-pressed={extension.pinned ?? false}
                  disabled={busy || !available}
                  onClick={() =>
                    void run({
                      type: "extension-pin",
                      id: extension.id,
                      pinned: !extension.pinned,
                    })
                  }
                >
                  {extension.pinned ? <Pin size={14} /> : <PinOff size={14} />}
                </Button>
              </Tooltip>
              <Menu
                className="browser-extension-more"
                onOpenChange={setSubmenuOpen}
                label={`${extension.name} · ${labels.more}`}
                items={[
                  {
                    label: text.extensionOpen,
                    disabled: !extension.enabled || busy,
                    onSelect: () =>
                      anchor.current && launch(extension, anchor.current),
                  },
                  {
                    label: labels.options,
                    disabled:
                      !extension.hasOptions || !extension.enabled || busy,
                    onSelect: () =>
                      anchor.current && launch(extension, anchor.current, true),
                  },
                  {
                    label: extension.enabled ? labels.disable : labels.enable,
                    separatorBefore: true,
                    disabled: busy,
                    onSelect: () =>
                      void run({
                        type: "extension-enable",
                        id: extension.id,
                        enabled: !extension.enabled,
                      }),
                  },
                  {
                    label: text.remove,
                    danger: true,
                    disabled: busy,
                    onSelect: () => {
                      changeOpen(false);
                      void confirmRemove(extension)
                        .then((confirmed) => {
                          if (confirmed)
                            void run({
                              type: "extension-remove",
                              id: extension.id,
                            });
                        })
                        .catch(fail);
                    },
                  },
                ]}
              />
            </div>
          ))}
        </div>
        <div className="browser-extensions-menu-footer">
          <Button
            variant="ghost"
            size="small"
            onClick={() => {
              changeOpen(false);
              onManage();
            }}
          >
            <span>{labels.manage}</span>
            <Settings2 size={14} />
          </Button>
          <Button
            variant="ghost"
            size="small"
            onClick={() => {
              changeOpen(false);
              onVisitStore();
            }}
          >
            <span>{labels.store}</span>
            <ExternalLink size={14} />
          </Button>
        </div>
      </PopoverMorph>
    </div>
  );
}
