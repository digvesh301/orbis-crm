export async function exportToCsv(apiPath: string, filename: string) {
    try {
        const { api } = await import('./api');
        
        // Fetch up to 1000 records for the export
        const response = await api.get(`${apiPath}${apiPath.includes('?') ? '&' : '?'}limit=1000`);
        const data = response.data.data;
        
        if (!data || !data.length) {
            alert('No data to export');
            return;
        }

        // Get headers from first object
        const headers = Object.keys(data[0]);
        
        // Helper to format values
        const formatValue = (val: any) => {
            if (val === null || val === undefined) return '';
            
            // If it's an object, try to extract a meaningful string or stringify it safely
            if (typeof val === 'object') {
                if (val.name) return `"${val.name.replace(/"/g, '""')}"`;
                return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
            }
            
            const strVal = String(val);
            // Escape double quotes and enclose in quotes if there's a comma or newline
            if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
                return `"${strVal.replace(/"/g, '""')}"`;
            }
            return strVal;
        };

        // Build CSV content
        const csvContent = [
            headers.join(','), // Header row
            ...data.map((row: any) => headers.map(header => formatValue(row[header])).join(','))
        ].join('\n');

        // Create Blob and trigger download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    } catch (error) {
        console.error('Export failed:', error);
        alert('Failed to export data');
    }
}
