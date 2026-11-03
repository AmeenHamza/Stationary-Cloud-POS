import { Module } from '@nestjs/common';

import { DashboardService } from './application/dashboard.service';
import { InsightsService } from './application/insights.service';
import { DashboardResolver } from './graphql/dashboard.resolver';
import { InsightMetricsRepository } from './persistence/insight-metrics.repository';
import { SalesMetricsRepository } from './persistence/sales-metrics.repository';
import { StockMetricsRepository } from './persistence/stock-metrics.repository';

/**
 * Dashboard aggregates (F-06, F-07) and the bounded aggregates behind the AI Assistant (F-29). The
 * one documented exception to module boundaries (ARCHITECTURE.md §7.1): read-only SQL across other
 * modules' tables; it never writes.
 */
@Module({
  providers: [
    DashboardResolver,
    DashboardService,
    InsightsService,
    SalesMetricsRepository,
    StockMetricsRepository,
    InsightMetricsRepository,
  ],
  exports: [DashboardService, InsightsService],
})
export class ReportingModule {}
