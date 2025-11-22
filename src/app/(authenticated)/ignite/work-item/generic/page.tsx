export default async function GenericPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ label?: string }> | { label?: string } 
}) {
  // Handle both Promise and object cases
  const params = searchParams instanceof Promise
    ? await searchParams 
    : searchParams;
  
  return (
    <div>
      Unmapped work item: {params.label}
    </div>
  );
}

