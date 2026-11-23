import { Injectable } from "@angular/core";
import { RepriceReport } from "../models/reprice-report.model";

@Injectable({
    providedIn: 'root'
})
export class RepriceSvgReportService {
    createSvg(report: RepriceReport): string {
        const width = 1000;
        const padding = 48;
        const headerHeight = 190;
        const summaryHeight = 150;
        const tableHeaderHeight = 54;
        const baseRowHeight = 64;
        const footerHeight = 72;

        const lineHeight = 22;
        const fontSize = 17;

        // Подготавливаем строки таблицы с переносами
        const rowLayouts = report.products.map(product => {
            const nameLines = this.wrapText(product.name, 43);
            const articleLines = this.wrapText(product.article || '—', 13);

            const maxLines = Math.max(nameLines.length, articleLines.length);

            const rowHeight = Math.max(
                baseRowHeight,
                maxLines * lineHeight + 24
            );

            return {
                product,
                nameLines,
                articleLines,
                rowHeight
            };
        });

        const tableRowsHeight = rowLayouts.reduce(
            (total, row) => total + row.rowHeight,
            0
        );

        const tableHeight = tableHeaderHeight + tableRowsHeight;

        const height =
            padding * 2 +
            headerHeight +
            summaryHeight +
            tableHeight +
            footerHeight;

        const tableY = padding + headerHeight + summaryHeight;

        // Генерируем строки таблицы
        let currentY = tableY + tableHeaderHeight;

        const rows = rowLayouts.map(row => {
            const y = currentY;
            currentY += row.rowHeight;

            const textBlockHeight = Math.max(
                row.nameLines.length,
                row.articleLines.length
            ) * lineHeight;

            const textStartY = y + (row.rowHeight - textBlockHeight) / 2 + fontSize;

            const nameText = this.renderMultilineText(
                padding + 12,
                textStartY,
                row.nameLines,
                lineHeight
            );

            const articleText = this.renderMultilineText(
                500,
                textStartY,
                row.articleLines,
                lineHeight
            );

            const priceY = y + row.rowHeight / 2 + 6;

            return `
            <g>
                <line
                    x1="${padding}"
                    y1="${y + row.rowHeight}"
                    x2="${width - padding}"
                    y2="${y + row.rowHeight}"
                    stroke="#E5E7EB"
                />

                ${nameText}

                ${articleText}

                <text x="650" y="${priceY}" text-anchor="end">
                    ${this.formatPrice(row.product.oldPrice)}
                </text>

                <text x="790" y="${priceY}" text-anchor="end">
                    ${this.formatPrice(row.product.newPrice)}
                </text>

                <text
                    x="${width - padding - 12}"
                    y="${priceY}"
                    text-anchor="end"
                >
                    ${this.formatPrice(row.product.calculation.difference)}
                </text>
            </g>
        `;
        }).join('');

        return `
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="${width}"
            height="${height}"
            viewBox="0 0 ${width} ${height}"
        >
            <rect width="100%" height="100%" fill="#FFFFFF"/>

            <g font-family="Arial, sans-serif" fill="#111827">
                <!-- Заголовок -->
                <text
                    x="${padding}"
                    y="${padding + 42}"
                    font-size="32"
                    font-weight="700"
                >
                    ОТЧЁТ О ПЕРЕОЦЕНКЕ
                </text>

                <text
                    x="${padding}"
                    y="${padding + 86}"
                    font-size="24"
                    font-weight="600"
                >
                    ${this.escapeXml(report.name)}
                </text>

                <text
                    x="${padding}"
                    y="${padding + 122}"
                    font-size="18"
                    fill="#6B7280"
                >
                    Дата: ${this.formatDate(report.date)}
                </text>

                <!-- Сводка -->
                <g transform="translate(${padding}, ${padding + headerHeight})">
                    ${this.summaryCard(0, 'ТОВАРОВ', String(report.summary.productsCount))}
                    ${this.summaryCard(225, 'СТАРАЯ СУММА', this.formatPrice(report.summary.oldPriceTotal))}
                    ${this.summaryCard(450, 'НОВАЯ СУММА', this.formatPrice(report.summary.newPriceTotal))}
                    ${this.summaryCard(675, 'ИЗМЕНЕНИЕ', this.formatPrice(report.summary.differenceTotal))}
                </g>

                <!-- Заголовок таблицы -->
                <rect
                    x="${padding}"
                    y="${tableY}"
                    width="${width - padding * 2}"
                    height="${tableHeaderHeight}"
                    rx="8"
                    fill="#F3F4F6"
                />

                <g font-size="15" font-weight="600" fill="#4B5563">
                    <text x="${padding + 12}" y="${tableY + 34}">ТОВАР</text>
                    <text x="500" y="${tableY + 34}">АРТИКУЛ</text>
                    <text x="650" y="${tableY + 34}" text-anchor="end">СТАРАЯ</text>
                    <text x="790" y="${tableY + 34}" text-anchor="end">НОВАЯ</text>
                    <text x="${width - padding - 12}" y="${tableY + 34}" text-anchor="end">РАЗНИЦА</text>
                </g>

                <!-- Строки товаров -->
                <g font-size="${fontSize}">
                    ${rows}
                </g>

                <!-- Итог -->
                <text
                    x="${padding}"
                    y="${height - padding + 8}"
                    font-size="15"
                    fill="#6B7280"
                >
                    Изменение в процентах:
                    ${this.formatPercentage(report.summary.percentageTotal)}
                </text>
            </g>
        </svg>
    `;
    }

    /**
     * Разбивает текст на строки заданной максимальной длины.
     * Длинные слова тоже разбиваются, чтобы не выходить за границы колонки.
     */
    private wrapText(value: string, maxChars: number): string[] {
        const words = value.trim().split(/\s+/).filter(Boolean);

        if (!words.length) return ['—'];

        const chunks: string[] = [];

        for (const word of words) {
            const characters = Array.from(word);

            if (characters.length <= maxChars) {
                chunks.push(word);
                continue;
            }

            for (let i = 0; i < characters.length; i += maxChars) {
                chunks.push(characters.slice(i, i + maxChars).join(''));
            }
        }

        const lines: string[] = [];
        let currentLine = '';

        for (const word of chunks) {
            const candidate = currentLine
                ? `${currentLine} ${word}`
                : word;

            if (Array.from(candidate).length <= maxChars) {
                currentLine = candidate;
            } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            }
        }

        if (currentLine) lines.push(currentLine);

        return lines;
    }

    /**
     * Создаёт SVG text с несколькими строками.
     */
    private renderMultilineText(
        x: number,
        y: number,
        lines: string[],
        lineHeight: number
    ): string {
        const tspans = lines.map((line, index) => `
        <tspan
            x="${x}"
            dy="${index === 0 ? 0 : lineHeight}"
        >${this.escapeXml(line)}</tspan>
    `).join('');

        return `
        <text x="${x}" y="${y}">
            ${tspans}
        </text>
    `;
    }

    private summaryCard(x: number, label: string, value: string): string {
        return `
            <g transform="translate(${x}, 0)">
                <rect width="205" height="112" rx="10" fill="#F9FAFB"/>
                <text x="16" y="34" font-size="13" fill="#6B7280">${label}</text>
                <text x="16" y="76" font-size="22" font-weight="700">${value}</text>
            </g>
        `;
    }

    private formatPrice(value: number): string {
        return new Intl.NumberFormat('ru-RU', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value / 100) + ' ₴';
    }

    private formatPercentage(value: number | null): string {
        if (value === null) return '—';

        return new Intl.NumberFormat('ru-RU', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value) + '%';
    }

    private formatDate(value: string): string {
        const [year, month, day] = value.split('-').map(Number);

        return new Intl.DateTimeFormat('ru-RU').format(
            new Date(year, month - 1, day)
        );
    }

    private escapeXml(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
}