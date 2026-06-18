import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ReviewService } from './review.service';
import { RegisterReviewDto, ProcessReviewDto, QueryReviewsDto } from './review.dto';

@Controller('api/reviews')
export class ReviewController {
  constructor(private readonly service: ReviewService) {}

  @Get('users')
  getUsers() {
    return this.service.getUsers();
  }

  @Get('statistics')
  getStatistics() {
    return this.service.getStatistics();
  }

  @Get()
  findAll(@Query() query: QueryReviewsDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.getDetailWithRecords(id);
  }

  @Post('register')
  register(@Body() dto: RegisterReviewDto) {
    return this.service.register(dto);
  }

  @Post('submit-review')
  submitReview(@Body() dto: ProcessReviewDto) {
    return this.service.submitReview(dto);
  }

  @Post('request-correction')
  requestCorrection(@Body() dto: ProcessReviewDto) {
    return this.service.requestCorrection(dto);
  }

  @Post('correct')
  correct(@Body() dto: ProcessReviewDto) {
    return this.service.correct(dto);
  }

  @Post('confirm-complete')
  confirmComplete(@Body() dto: ProcessReviewDto) {
    return this.service.confirmComplete(dto);
  }

  @Post('reject-review')
  rejectReview(@Body() dto: ProcessReviewDto) {
    return this.service.rejectReview(dto);
  }
}
