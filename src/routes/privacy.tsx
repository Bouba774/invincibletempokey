import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Shield, HardDrive, Music2, EyeOff, Ban, Mail } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Politique de confidentialité — TempoKey" },
      {
        name: "description",
        content:
          "TempoKey fonctionne hors ligne. Vos fichiers audio restent sur votre appareil. Aucune collecte, aucune vente de données.",
      },
    ],
  }),
  component: PrivacyPage,
});

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Shield;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card/60 p-5">
      <div className="mb-3 flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <Link
        to="/settings"
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Retour
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight">
        Politique de confidentialité
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Dernière mise à jour : 16 juin 2026
      </p>

      <div className="mt-6 space-y-4">
        <Section icon={Shield} title="En bref">
          <p>
            <strong className="text-foreground">TempoKey est une application locale.</strong>{" "}
            L'analyse audio, le stockage de la bibliothèque, le cache et les
            préférences fonctionnent entièrement sur votre appareil. Aucun
            compte n'est requis.
          </p>
          <ul className="ml-5 list-disc space-y-1">
            <li>Aucun fichier audio n'est envoyé sur Internet.</li>
            <li>Aucun identifiant publicitaire n'est collecté.</li>
            <li>Aucune donnée n'est revendue à des tiers.</li>
          </ul>
        </Section>

        <Section icon={Music2} title="Données traitées localement">
          <p>
            Pour fonctionner, TempoKey lit et analyse les fichiers audio que
            vous lui désignez explicitement (sélection de dossier). Sont
            calculés et stockés localement :
          </p>
          <ul className="ml-5 list-disc space-y-1">
            <li>Empreinte BPM, tonalité, Camelot, énergie, durée.</li>
            <li>Aperçus de forme d'onde (waveform).</li>
            <li>Préférences d'interface (thème, tri, filtres).</li>
          </ul>
          <p>
            Ces données sont conservées dans le stockage privé de l'application
            (IndexedDB / cache local Android). Vous pouvez les effacer à tout
            moment depuis <em>Paramètres → Cache</em>.
          </p>
        </Section>

        <Section icon={HardDrive} title="Permissions Android">
          <p>TempoKey demande uniquement les permissions strictement nécessaires :</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              <strong className="text-foreground">READ_MEDIA_AUDIO</strong>{" "}
              (Android 13+) ou <strong className="text-foreground">READ_EXTERNAL_STORAGE</strong>{" "}
              (≤ Android 12) — pour lire les pistes que vous sélectionnez.
            </li>
            <li>
              <strong className="text-foreground">INTERNET</strong> — requis
              par le runtime Android (WebView). TempoKey ne l'utilise pour
              aucun envoi de données utilisateur.
            </li>
          </ul>
          <p>
            Aucune permission de localisation, micro, contacts, caméra,
            téléphonie, SMS ou notifications en arrière-plan n'est demandée.
          </p>
        </Section>

        <Section icon={EyeOff} title="Analytics & crash reports">
          <p>
            TempoKey n'active <strong className="text-foreground">aucun analytics par défaut</strong>.
            Vous pouvez, si vous le souhaitez, activer manuellement depuis{" "}
            <em>Paramètres → Confidentialité</em> :
          </p>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              Des évènements anonymes (ex. <code>analyze_started</code>) — jamais
              de noms de fichiers, jamais de contenu audio.
            </li>
            <li>
              Des rapports de crash anonymes (trace technique uniquement).
            </li>
          </ul>
          <p>Tout peut être désactivé à n'importe quel moment.</p>
        </Section>

        <Section icon={Ban} title="Partage avec des tiers">
          <p>
            TempoKey ne vend, ne loue et ne partage aucune donnée personnelle.
            Aucun SDK publicitaire n'est intégré.
          </p>
        </Section>

        <Section icon={Mail} title="Contact">
          <p>
            Pour toute question relative à cette politique de confidentialité,
            ou pour exercer vos droits (accès, suppression), contactez :{" "}
            <a
              className="text-primary underline-offset-2 hover:underline"
              href="mailto:privacy@tempokey.app"
            >
              privacy@tempokey.app
            </a>
            .
          </p>
        </Section>
      </div>
    </div>
  );
}
