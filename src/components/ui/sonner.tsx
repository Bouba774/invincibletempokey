import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:py-2 group-[.toaster]:px-3 group-[.toaster]:min-h-0 group-[.toaster]:gap-2 group-[.toaster]:text-[13px] group-[.toaster]:rounded-xl [&>button[data-close-button]]:left-auto [&>button[data-close-button]]:right-0 [&>button[data-close-button]]:translate-x-1/3 [&>button[data-close-button]]:-translate-y-1/3",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
