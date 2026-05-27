export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-dvh w-full flex-1 flex-col">{children}</div>
  );
}
