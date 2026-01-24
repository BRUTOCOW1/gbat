// ANGULAR 
import { BrowserModule } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { RouterOutlet, RouterModule, RouterLink, RouterLinkActive } from '@angular/router';

// BAG AND CLUBS 
import { CreateGolfBagComponent } from './bagAndClubs/create-golf-bag/create-golf-bag.component';
import { GolfBagComponent } from './bagAndClubs/golf-bag/golf-bag.component';
import { GolfClubComponent } from './bagAndClubs/golf-club/golf-club.component';

// COURSE 
import { GolfCourseComponent } from './course/golf-course/golf-course.component';
import { CourseBuilderComponent } from './course/course-builder/course-builder.component';

// HOLE AND SHOTS 
import { GolfHoleComponent } from './holeAndShots/golf-hole/golf-hole.component';
import { GolfShotComponent } from './holeAndShots/golf-shot/golf-shot.component';
import { GolfShotEntryComponent } from './holeAndShots/golf-shot-entry/golf-shot-entry.component';

// ROUND 
import { GolfRoundComponent } from './round/golf-round/golf-round.component';
import { GolfRoundsComponent } from './round/golf-rounds/golf-rounds.component';
import { NewRoundComponent } from './round/new-round/new-round.component';

// SHARED 
import { BlogComponent } from './shared/blog/blog.component';
import { NavbarComponent } from './shared/navbar/navbar.component';
import { NotificationComponent } from './shared/components/notification/notification.component';

// USER OPS 
import { LoginComponent } from './userOps/login/login.component';
import { LogoutComponent } from './userOps/logout/logout.component';
import { ProfileComponent } from './userOps/profile/profile.component';
import { RegisterComponent } from './userOps/register/register.component';

// TOP LEVEL
import { AppComponent } from './app.component';
import { routes } from './app.routes'


@NgModule({
  declarations: [
    AppComponent,
    BlogComponent,
    CourseBuilderComponent,
    GolfShotComponent,
    GolfShotEntryComponent,
    GolfHoleComponent,
    GolfClubComponent,
    GolfCourseComponent,
    GolfRoundComponent,
    GolfRoundsComponent,
    GolfBagComponent,
    LoginComponent,
    RegisterComponent,
    NavbarComponent,
    CreateGolfBagComponent,
    ProfileComponent,
    NewRoundComponent,
    NotificationComponent

  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    ReactiveFormsModule,
    FormsModule,
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    RouterModule,
    RouterModule.forRoot(routes)
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
