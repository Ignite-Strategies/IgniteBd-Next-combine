export default async function GenericPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ label?: string }> | { label?: string } 
}) {
  const params = typeof searchParams.then === 'function' 
    ? await searchParams 
    : searchParams;
  
  return (
    <div>
      Unmapped work item: {params.label}
    </div>
  );
}

