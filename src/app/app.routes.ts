import { Routes } from '@angular/router';
// BAG AND CLUBS 
import { CreateGolfBagComponent } from './bagAndClubs/create-golf-bag/create-golf-bag.component';
import { GolfBagComponent } from './bagAndClubs//golf-bag/golf-bag.component';
import { GolfClubComponent } from './bagAndClubs//golf-club/golf-club.component';

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
import { AuthGuard } from './shared/guards/auth.guard';

// USER OPS 
import { LoginComponent } from './userOps/login/login.component';
import { LogoutComponent } from './userOps/logout/logout.component';
import { ProfileComponent } from './userOps/profile/profile.component';
import { RegisterComponent } from './userOps/register/register.component';


export const routes: Routes = [
    // ✅ Alphabetized Components
    { path: 'blog-component', component: BlogComponent },
    { path: 'dashboard', component: GolfRoundsComponent, canActivate: [AuthGuard] },
    { path: 'golf-round/:id', component: GolfRoundComponent, canActivate: [AuthGuard] },
    { path: 'golf-bags', component: GolfBagComponent },
    { path: 'golf-bag/:id', component: GolfBagComponent },
    { path: 'golf-clubs', component: GolfClubComponent },
    { path: 'golf-courses', component: GolfCourseComponent }, // ✅ Added
    { path: 'golf-hole/:holeNumber', component: GolfHoleComponent },
    // app.routes.ts
    { path: 'golf-shot/:holeNumber/:shotNumber/edit', component: GolfShotEntryComponent },
    { path: 'golf-shot/:holeNumber/newShot',         component: GolfShotEntryComponent },
    { path: 'golf-shot/:holeNumber/:shotNumber',     component: GolfShotComponent },


    { path: 'add-clubs', component: GolfClubComponent },
    // { path: 'golf-shot/:holeId/:userId/:golfBagId', component: GolfShotComponent },
    { path: 'login', component: LoginComponent },
    { path: 'new-bag', component: CreateGolfBagComponent },
    { path: 'profile', component: ProfileComponent },
    { path: 'register', component: RegisterComponent },
    { path: 'new-round', component: NewRoundComponent},
    { path: 'new-course', component: CourseBuilderComponent},
  
    // ✅ Organized Redirects
    { path: 'blog-component/golf-component', redirectTo: 'golf-component' },
    { path: 'golf-component/blog-component', redirectTo: 'blog-component' },
    { path: 'golf-component/golf-shot-component', redirectTo: 'golf-shot-component' },
    { path: 'golf-component/round-component', redirectTo: 'round-component' },
    { path: 'golf-shot-component/golf-component', redirectTo: 'golf-component' },
    { path: '*/login-component', redirectTo: 'login' },
  
    // ✅ Default Fallback (Optional)
    { path: '**', redirectTo: 'dashboard' },
  ];
  