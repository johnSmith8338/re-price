import { Injectable } from "@angular/core";

@Injectable({
    providedIn: 'root'
})
export class RepricePngExportService {
    async exportSvg(svg: string, fileName: string): Promise<void> {
        const blob = new Blob([svg], {
            type: 'image/svg+xml;charset=utf-8'
        })

        const url = URL.createObjectURL(blob);

        try {
            const image = await this.loadImage(url);
            const canvas = document.createElement('canvas');

            canvas.width = image.naturalWidth * 2;
            canvas.height = image.naturalHeight * 2;

            const context = canvas.getContext('2d');
            if (!context) throw new Error('Не удалосьсоздать canvas-контекст');

            context.scale(2, 2);
            context.drawImage(image, 0, 0);

            const pngBlob = await this.canvasToBlob(canvas);
            this.download(pngBlob, fileName);
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    private loadImage(url: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const image = new Image();

            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('Не удалось преобразовать svg в изображение'));

            image.src = url;
        })
    }

    private canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (!blob) {
                    reject(new Error('Не удалось создать png'));
                    return;
                }

                resolve(blob);
            }, 'image/png')
        })
    }

    private download(blob: Blob, fileName: string) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = fileName;
        link.click();

        URL.revokeObjectURL(url);
    }
}