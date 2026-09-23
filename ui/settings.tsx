import { mountPlugin } from "@modera/plugin-sdk/react";
import "@modera/ui/styles.css";
import "./manager-legacy.css";
import "./settings-extra.css";
import { BrowserSettings } from "../src/settings-page";
mountPlugin(<BrowserSettings />);
