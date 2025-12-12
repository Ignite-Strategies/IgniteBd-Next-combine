export default async function GenericPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ label?: string }>
}) {
  // In Next.js 15, searchParams is always a Promise in server components
  const params = await searchParams;
  
  return (
    <div>
      Unmapped work item: {params.label}
    </div>
  );
}

