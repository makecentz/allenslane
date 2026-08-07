"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";

type IntegrationSetting = {
  id: string;
  setting_key: string;
  provider: string;
  label: string;
  kind: "api_key" | "client_id" | "client_secret" | "identifier" | "url" | "webhook_secret";
  description: string;
  is_required: boolean;
  display_order: number;
  callback_url: string | null;
  external_console_url: string | null;
  storage_source: "not_configured" | "edge_environment" | "vault";
  configured_at: string | null;
};

const providerLabels: Record<string, string> = {
  application: "Application",
  stripe: "Stripe",
  quickbooks: "QuickBooks Online",
  mailchimp: "Mailchimp",
  resend: "Resend (final phase)",
};

const statusLabels: Record<IntegrationSetting["storage_source"], string> = {
  not_configured: "Not configured",
  edge_environment: "Protected environment",
  vault: "Vault managed",
};

const configuredDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "The integration setting could not be saved.";
}

function isSecret(setting: IntegrationSetting) {
  return ["api_key", "client_secret", "webhook_secret"].includes(setting.kind);
}

export function IntegrationSettings() {
  const [settings, setSettings] = useState<IntegrationSetting[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copiedKey, setCopiedKey] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    const { data, error: loadError } = await getSupabaseBrowserClient()
      .from("integration_settings")
      .select("id,setting_key,provider,label,kind,description,is_required,display_order,callback_url,external_console_url,storage_source,configured_at")
      .eq("is_active", true)
      .order("provider")
      .order("display_order");
    if (loadError) throw loadError;
    return (data ?? []) as IntegrationSetting[];
  }, []);

  useEffect(() => {
    let active = true;
    async function loadInitialSettings() {
      try {
        const loadedSettings = await fetchSettings();
        if (active) setSettings(loadedSettings);
      } catch (loadError) {
        if (active) setError(errorMessage(loadError));
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadInitialSettings();
    return () => {
      active = false;
    };
  }, [fetchSettings]);

  async function saveSetting(event: FormEvent<HTMLFormElement>, setting: IntegrationSetting) {
    event.preventDefault();
    const value = values[setting.setting_key] ?? "";
    const reason = reasons[setting.setting_key] ?? "";
    setBusyKey(setting.setting_key);
    setError("");
    setNotice("");
    try {
      const { error: saveError } = await getSupabaseBrowserClient().rpc("save_integration_setting", {
        p_setting_key: setting.setting_key,
        p_value: value,
        p_reason: reason,
      });
      if (saveError) throw saveError;
      setValues((current) => ({ ...current, [setting.setting_key]: "" }));
      setReasons((current) => ({ ...current, [setting.setting_key]: "" }));
      setSettings(await fetchSettings());
      setNotice(`${setting.label} was replaced and encrypted in Supabase Vault.`);
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setBusyKey("");
    }
  }

  async function copyCallback(settingKey: string, callbackUrl: string) {
    try {
      await navigator.clipboard.writeText(callbackUrl);
      setCopiedKey(settingKey);
    } catch {
      setError("The callback URL could not be copied. Select it and copy it manually.");
    }
  }

  const providers = settings.reduce<Record<string, IntegrationSetting[]>>((groups, setting) => {
    (groups[setting.provider] ??= []).push(setting);
    return groups;
  }, {});

  return (
    <section className="admin-panel integration-admin-panel" aria-labelledby="integration-settings-title">
      <div className="admin-section-heading">
        <div>
          <p className="eyebrow">Encrypted configuration</p>
          <h3 id="integration-settings-title">API keys &amp; webhooks</h3>
        </div>
        <span>System Administrators only</span>
      </div>
      <p className="admin-helper integration-intro">
        Replace server credentials here without editing or redeploying application files. Existing values are never displayed; every replacement is encrypted in Supabase Vault and recorded in the audit trail.
      </p>

      {error ? <p className="form-error admin-action-message" role="alert">{error}</p> : null}
      {notice ? <p className="form-notice admin-action-message" role="status">{notice}</p> : null}
      {loading ? <p className="integration-loading" aria-live="polite">Loading protected integration settings…</p> : null}

      {!loading ? (
        <div className="integration-provider-stack">
          {Object.entries(providers).map(([provider, providerSettings]) => (
            <section className="integration-provider-group" key={provider} aria-labelledby={`provider-${provider}`}>
              <div className="integration-provider-heading">
                <h4 id={`provider-${provider}`}>{providerLabels[provider] ?? provider}</h4>
                <span>{providerSettings.length} {providerSettings.length === 1 ? "setting" : "settings"}</span>
              </div>
              <div className="integration-setting-grid">
                {providerSettings.map((setting) => {
                  const value = values[setting.setting_key] ?? "";
                  const reason = reasons[setting.setting_key] ?? "";
                  const saving = busyKey === setting.setting_key;
                  return (
                    <article className="integration-setting-card" key={setting.id}>
                      <div className="integration-setting-title">
                        <div>
                          <h5>{setting.label}</h5>
                          <p>{setting.description}</p>
                        </div>
                        <span className={`integration-status integration-status-${setting.storage_source}`}>
                          {statusLabels[setting.storage_source]}
                        </span>
                      </div>
                      <div className="integration-setting-meta">
                        <span>{setting.is_required ? "Required now" : "Optional / future phase"}</span>
                        <span>{setting.configured_at ? `Updated ${configuredDate.format(new Date(setting.configured_at))}` : "No value saved"}</span>
                      </div>

                      {setting.callback_url ? (
                        <div className="integration-callback">
                          <label htmlFor={`callback-${setting.setting_key}`}>Webhook callback URL</label>
                          <div>
                            <input id={`callback-${setting.setting_key}`} readOnly value={setting.callback_url} />
                            <button type="button" onClick={() => void copyCallback(setting.setting_key, setting.callback_url!)}>
                              {copiedKey === setting.setting_key ? "Copied" : "Copy"}
                            </button>
                          </div>
                        </div>
                      ) : null}

                      <form className="integration-setting-form" onSubmit={(event) => void saveSetting(event, setting)}>
                        <label htmlFor={`value-${setting.setting_key}`}>
                          New {setting.label.toLowerCase()}
                          <input
                            id={`value-${setting.setting_key}`}
                            type={isSecret(setting) ? "password" : setting.kind === "url" ? "url" : "text"}
                            autoComplete="off"
                            required
                            value={value}
                            onChange={(event) => setValues((current) => ({ ...current, [setting.setting_key]: event.target.value }))}
                            placeholder={setting.storage_source === "not_configured" ? "Enter value" : "Enter a replacement value"}
                          />
                        </label>
                        <label htmlFor={`reason-${setting.setting_key}`}>
                          Operational reason
                          <input
                            id={`reason-${setting.setting_key}`}
                            required
                            minLength={10}
                            value={reason}
                            onChange={(event) => setReasons((current) => ({ ...current, [setting.setting_key]: event.target.value }))}
                            placeholder="At least 10 characters"
                          />
                        </label>
                        <div className="integration-setting-actions">
                          <button className="dark-button" type="submit" disabled={busyKey !== "" || value.trim().length < 3 || reason.trim().length < 10}>
                            {saving ? "Encrypting…" : setting.storage_source === "not_configured" ? "Save securely" : "Replace securely"}
                          </button>
                          {setting.external_console_url ? <a href={setting.external_console_url} target="_blank" rel="noreferrer">Open provider console</a> : null}
                        </div>
                      </form>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </section>
  );
}
