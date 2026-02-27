import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { FileKey, Upload, CheckCircle, XCircle, AlertTriangle, Shield } from "lucide-react";
import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";

interface UploadResult {
  fileName: string;
  success: boolean;
  cnpj?: string;
  razaoSocial?: string;
  error?: string;
}

export default function Certificados() {
  const { data: contabilidades } = trpc.contabilidade.list.useQuery();
  const [selectedContab, setSelectedContab] = useState<string>("");
  const contabId = selectedContab ? parseInt(selectedContab) : contabilidades?.[0]?.id;

  const { data: certificados, isLoading } = trpc.certificado.list.useQuery(
    contabId ? { contabilidadeId: contabId } : undefined,
    { enabled: !!contabId }
  );

  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadMutation = trpc.certificado.uploadBatch.useMutation({
    onSuccess: (data) => {
      setUploadResults(data.results);
      const successCount = data.results.filter((r) => r.success).length;
      toast.success(`${successCount} de ${data.results.length} certificados processados com sucesso!`);
      utils.certificado.list.invalidate();
      utils.cliente.list.invalidate();
      setUploading(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setUploading(false);
    },
  });

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0 || !contabId) return;

      setUploading(true);
      setUploadResults([]);
      setUploadProgress(0);

      const certList: Array<{ fileName: string; fileData: string; senha: string }> = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = file.name;

        // Parse password from filename: nome,senha.pfx
        const nameWithoutExt = fileName.replace(/\.pfx$/i, "");
        const parts = nameWithoutExt.split(",");
        const senha = parts.length > 1 ? parts[parts.length - 1] : "";

        if (!senha) {
          setUploadResults((prev) => [
            ...prev,
            { fileName, success: false, error: "Formato inválido. Use: nome,senha.pfx" },
          ]);
          continue;
        }

        // Read file as base64
        const fileData = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = (reader.result as string).split(",")[1];
            resolve(base64);
          };
          reader.readAsDataURL(file);
        });

        certList.push({ fileName, fileData, senha });
        setUploadProgress(((i + 1) / files.length) * 50);
      }

      if (certList.length > 0) {
        setUploadProgress(60);
        uploadMutation.mutate({ contabilidadeId: contabId, certificados: certList });
      } else {
        setUploading(false);
      }

      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [contabId, uploadMutation]
  );

  const isExpired = (validTo: Date | string | null) => {
    if (!validTo) return false;
    return new Date(validTo) < new Date();
  };

  const isExpiringSoon = (validTo: Date | string | null) => {
    if (!validTo) return false;
    const d = new Date(validTo);
    const thirtyDays = new Date();
    thirtyDays.setDate(thirtyDays.getDate() + 30);
    return d > new Date() && d < thirtyDays;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Certificados Digitais</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Upload em lote de certificados .pfx (formato: nome,senha.pfx)
            </p>
          </div>
          <div className="flex gap-2">
            {contabilidades && contabilidades.length > 1 && (
              <Select value={selectedContab || String(contabilidades[0]?.id ?? "")} onValueChange={setSelectedContab}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Contabilidade" />
                </SelectTrigger>
                <SelectContent>
                  {contabilidades.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Upload Area */}
        <Card>
          <CardContent className="p-6">
            <div
              className="border-2 border-dashed border-primary/30 rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pfx"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <Upload className="h-10 w-10 mx-auto text-primary/60 mb-3" />
              <h3 className="font-semibold text-lg">Upload de Certificados em Lote</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Arraste ou clique para selecionar arquivos .pfx
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Formato do arquivo: <code className="bg-muted px-1.5 py-0.5 rounded text-primary font-mono">nomedocertificado,senha.pfx</code>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                O CNPJ e razão social serão extraídos automaticamente do certificado
              </p>
            </div>

            {uploading && (
              <div className="mt-4">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-sm text-muted-foreground mt-2 text-center">Processando certificados...</p>
              </div>
            )}

            {/* Upload Results */}
            {uploadResults.length > 0 && (
              <div className="mt-6 space-y-3">
                <h4 className="font-semibold text-sm">Resultado do Upload</h4>
                {uploadResults.map((r, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 p-3 rounded-lg text-sm ${
                      r.success ? "bg-green-50 dark:bg-green-500/10 text-green-800 dark:text-green-300" : "bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300"
                    }`}
                  >
                    {r.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{r.fileName}</p>
                      {r.success ? (
                        <p className="text-xs mt-0.5">
                          {r.razaoSocial} - CNPJ: {r.cnpj} (cliente cadastrado automaticamente)
                        </p>
                      ) : (
                        <p className="text-xs mt-0.5">{r.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Certificates Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Certificados Cadastrados
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Emissor</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
                  </TableRow>
                ) : !certificados || certificados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <FileKey className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                      <p className="font-medium">Nenhum certificado cadastrado</p>
                      <p className="text-sm text-muted-foreground mt-1">Faça upload de certificados .pfx acima.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  certificados.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.razaoSocial || "-"}</TableCell>
                      <TableCell className="font-mono text-sm">{c.cnpj}</TableCell>
                      <TableCell className="text-sm">{c.issuer || "-"}</TableCell>
                      <TableCell className="text-sm">
                        {c.validTo ? (
                          <span className={isExpired(c.validTo) ? "text-red-600" : isExpiringSoon(c.validTo) ? "text-amber-600" : ""}>
                            {new Date(c.validTo).toLocaleDateString("pt-BR")}
                          </span>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        {isExpired(c.validTo) ? (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="h-3 w-3" />Expirado
                          </Badge>
                        ) : isExpiringSoon(c.validTo) ? (
                          <Badge variant="secondary" className="gap-1 bg-amber-500/20 text-amber-700 dark:bg-amber-500/30 dark:text-amber-200 border border-amber-400/50">
                            <AlertTriangle className="h-3 w-3" />Expirando
                          </Badge>
                        ) : c.ativo ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle className="h-3 w-3" />Ativo
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
